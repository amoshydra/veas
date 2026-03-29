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

  const stat = statSync(file.path);
  const contentType = file.mimeType || "application/octet-stream";

  return new Response(createReadStream(file.path) as any, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${file.filename}"`,
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

export default filesRoute;
