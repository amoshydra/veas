import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { db } from "../db/index.js";
import { jobs, files } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { enqueueJob } from "../services/job-queue.js";

const opsRoute = new Hono();

const OPERATION_NAMES = [
  "trim",
  "crop",
  "concat",
  "transcode",
  "resize",
  "filter",
  "gif",
  "speed",
  "audio-extract",
  "watermark",
  "rotate",
  "flip",
  "reverse",
  "loop",
  "subtitle",
  "pip",
  "thumbnail",
];

function createJob(
  sessionId: string,
  operation: string,
  inputFileIds: string[],
  params: Record<string, any>,
) {
  // Resolve file paths from DB
  const inputFilePaths: string[] = [];
  for (const fileId of inputFileIds) {
    const file = db.select().from(files).where(eq(files.id, fileId)).get();
    if (!file) throw new Error(`File not found: ${fileId}`);
    inputFilePaths.push(file.path);
  }

  // Handle concat specially — write a concat list file
  if (operation === "concat" && inputFilePaths.length > 1) {
    const listDir = "./data/tmp";
    mkdirSync(listDir, { recursive: true });
    const listPath = join(listDir, `concat_${uuidv4()}.txt`);
    const content = inputFilePaths.map((p) => `file '${p}'`).join("\n");
    writeFileSync(listPath, content);
    params.listPath = listPath;
  }

  const jobId = uuidv4();
  db.insert(jobs)
    .values({
      id: jobId,
      sessionId,
      operation,
      params: JSON.stringify(params),
      inputFiles: JSON.stringify(inputFilePaths),
      status: "queued",
    })
    .run();

  enqueueJob(jobId);

  return db.select().from(jobs).where(eq(jobs.id, jobId)).get();
}

// Dynamic route for each operation
for (const op of OPERATION_NAMES) {
  opsRoute.post(`/${op}`, async (c) => {
    try {
      const body = await c.req.json();
      const job = createJob(body.sessionId, op, body.inputFiles || [], body.params || {});
      return c.json(job, 201);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });
}

export default opsRoute;
