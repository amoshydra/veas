import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { createWriteStream, statSync, createReadStream, existsSync, rmSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { db } from "../db/index.js";
import { files } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { ffprobe } from "../services/ffmpeg.js";

const filesRoute = new Hono();

const UPLOAD_DIR = "./data/uploads";
mkdirSync(UPLOAD_DIR, { recursive: true });

filesRoute.get("/", (c) => {
  const sessionId = c.req.query("sessionId");
  let result = db.select().from(files).all();
  if (sessionId) result = result.filter((f) => f.sessionId === sessionId);
  return c.json(result);
});

filesRoute.post("/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"] as File;
  const sessionId = (body["sessionId"] as string) || "default";

  if (!file) return c.json({ error: "No file provided" }, 400);

  const id = uuidv4();
  const ext = extname(file.name) || ".mp4";
  const sessionDir = join(UPLOAD_DIR, sessionId);
  mkdirSync(sessionDir, { recursive: true });
  const filePath = join(sessionDir, `${id}${ext}`);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ws = createWriteStream(filePath);
  ws.write(buffer);
  ws.end();

  await new Promise<void>((resolve) => ws.on("finish", resolve));

  let duration: number | undefined;
  let width: number | undefined;
  let height: number | undefined;

  try {
    const probe = await ffprobe(filePath);
    duration = parseFloat(probe.format.duration) || undefined;
    const videoStream = probe.streams.find((s) => s.codec_type === "video");
    if (videoStream) {
      width = videoStream.width;
      height = videoStream.height;
    }
  } catch {
    // non-critical
  }

  const record = {
    id,
    sessionId,
    filename: file.name,
    path: filePath,
    size: buffer.length,
    mimeType: file.type || "",
    duration: duration ?? null,
    width: width ?? null,
    height: height ?? null,
  };

  db.insert(files).values(record).run();

  return c.json(
    db.select().from(files).where(eq(files.id, id)).get(),
    201
  );
});

filesRoute.get("/:id", (c) => {
  const file = db.select().from(files).where(eq(files.id, c.req.param("id"))).get();
  if (!file) return c.json({ error: "File not found" }, 404);

  if (!existsSync(file.path)) return c.json({ error: "File not found on disk" }, 404);

  let fileSize: number;
  try {
    fileSize = statSync(file.path).size;
  } catch {
    return c.json({ error: "File not found on disk" }, 404);
  }
  const contentType = file.mimeType || "application/octet-stream";
  const range = c.req.header("range");

  // No range request — serve full file with range support advertised
  if (!range) {
    const stream = createReadStream(file.path);
    stream.on("error", () => {
      return c.json({ error: "File read error" }, 500);
    });
    return new Response(stream as any, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Content-Disposition": `inline; filename="${file.filename}"`,
      },
    });
  }

  // Parse range: "bytes=start-end"
  const match = range.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${fileSize}`,
      },
    });
  }

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${fileSize}`,
      },
    });
  }

  const chunkSize = end - start + 1;

  const stream = createReadStream(file.path, { start, end });
  stream.on("error", () => {
    return c.json({ error: "File read error" }, 500);
  });
  return new Response(stream as any, {
    status: 206,
    headers: {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": String(chunkSize),
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${file.filename}"`,
    },
  });
});

filesRoute.get("/:id/probe", async (c) => {
  const file = db.select().from(files).where(eq(files.id, c.req.param("id"))).get();
  if (!file) return c.json({ error: "File not found" }, 404);

  try {
    const probe = await ffprobe(file.path);
    return c.json(probe);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

filesRoute.get("/:id/thumbnail", async (c) => {
  const file = db.select().from(files).where(eq(files.id, c.req.param("id"))).get();
  if (!file) return c.json({ error: "File not found" }, 404);

  const thumbPath = file.path.replace(extname(file.path), "_thumb.jpg");

  if (!existsSync(thumbPath)) {
    const { generateThumbnail } = await import("../services/ffmpeg.js");
    try {
      await generateThumbnail(file.path, thumbPath);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }

  const stat = statSync(thumbPath);
  return new Response(createReadStream(thumbPath) as any, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=86400",
    },
  });
});

filesRoute.get("/:id/sprite", async (c) => {
  const file = db.select().from(files).where(eq(files.id, c.req.param("id"))).get();
  if (!file) return c.json({ error: "File not found" }, 404);

  const spritePath = file.path.replace(extname(file.path), "_sprite.jpg");
  const metaPath = file.path.replace(extname(file.path), "_sprite.json");

  // Return cached sprite metadata if it exists
  if (existsSync(spritePath) && existsSync(metaPath)) {
    const meta = JSON.parse(
      await import("node:fs").then((fs) => fs.readFileSync(metaPath, "utf-8"))
    );
    return c.json({ ...meta, spriteUrl: `/api/files/${file.id}/sprite.jpg` });
  }

  const duration = file.duration || 30;

  try {
    const { generateSpriteSheet } = await import("../services/ffmpeg.js");
    const result = await generateSpriteSheet(file.path, spritePath, duration);

    // Read sprite to get actual dimensions
    const spriteStat = statSync(spritePath);
    const actualHeight = Math.round(result.frameHeight * result.rows);

    const meta = {
      frameWidth: result.frameWidth,
      frameHeight: Math.round(spriteStat.size > 0 ? result.frameHeight : result.frameHeight),
      columns: result.columns,
      rows: result.rows,
      interval: result.interval,
      totalFrames: result.totalFrames,
      spriteSize: spriteStat.size,
    };

    // Save metadata
    const { writeFileSync } = await import("node:fs");
    writeFileSync(metaPath, JSON.stringify(meta));

    return c.json({ ...meta, spriteUrl: `/api/files/${file.id}/sprite.jpg` });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Serve sprite image (must be before /:id to avoid conflict)
filesRoute.get("/:id/sprite.jpg", (c) => {
  const file = db.select().from(files).where(eq(files.id, c.req.param("id"))).get();
  if (!file) return c.json({ error: "File not found" }, 404);

  const spritePath = file.path.replace(extname(file.path), "_sprite.jpg");
  if (!existsSync(spritePath)) return c.json({ error: "Sprite not found" }, 404);

  const stat = statSync(spritePath);
  return new Response(createReadStream(spritePath) as any, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=86400",
    },
  });
});

filesRoute.delete("/:id", (c) => {
  const file = db.select().from(files).where(eq(files.id, c.req.param("id"))).get();
  if (!file) return c.json({ error: "File not found" }, 404);

  // Delete from disk
  try { rmSync(file.path, { force: true }); } catch {}

  // Delete thumbnail if exists
  const thumbPath = file.path.replace(extname(file.path), "_thumb.jpg");
  try { rmSync(thumbPath, { force: true }); } catch {}

  // Delete from DB
  db.delete(files).where(eq(files.id, file.id)).run();

  return c.json({ ok: true });
});

const CACHE_DIR = "./data/cache";
filesRoute.get("/cache/:sessionId/:nodeId", async (c) => {
  const sessionId = c.req.param("sessionId");

  const cacheDir = join(CACHE_DIR, sessionId);
  if (!existsSync(cacheDir)) {
    return c.json({ error: "Cache not found" }, 404);
  }

  const fs = await import("node:fs");
  const files = fs.readdirSync(cacheDir);
  const mp4Files = files.filter((f: string) => f.endsWith(".mp4"));

  if (mp4Files.length === 0) {
    return c.json({ error: "No cached files found" }, 404);
  }

  const filePath = join(cacheDir, mp4Files[0]);
  const stat = statSync(filePath);

  return new Response(createReadStream(filePath) as any, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
    },
  });
});

export default filesRoute;
