import PQueue from "p-queue";
import { cpus } from "node:os";
import { statSync } from "node:fs";
import { basename } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { jobs, files } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { runFfmpeg, generateThumbnail, ffprobe } from "./ffmpeg.js";
import { buildFfmpegArgs } from "./operations.js";
import { emitProgress } from "./progress.js";

const queue = new PQueue({
  concurrency: Math.max(1, cpus().length - 1),
});

export function getQueueStats() {
  return {
    pending: queue.pending,
    size: queue.size,
    concurrency: queue.concurrency,
  };
}

export function enqueueJob(jobId: string) {
  queue.add(() => processJob(jobId));
}

async function processJob(jobId: string) {
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) return;

  const params = JSON.parse(job.params);
  const inputFiles = JSON.parse(job.inputFiles);

  db.update(jobs)
    .set({ status: "processing", progress: 0 })
    .where(eq(jobs.id, jobId))
    .run();

  try {
    const outputPath = `./data/output/${job.sessionId}/${jobId}_${params.outputName || "output"}.${params.format || "mp4"}`;

    if (job.operation === "thumbnail") {
      await generateThumbnail(
        inputFiles[0],
        outputPath,
        params.timestamp || "00:00:01"
      );
    } else {
      const args = buildFfmpegArgs(job.operation, inputFiles, params);
      await runFfmpeg({ jobId, args, outputPath });
    }

    // Register output as a file record
    const fileId = uuidv4();
    let duration: number | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let size = 0;

    try {
      size = statSync(outputPath).size;
      const probe = await ffprobe(outputPath);
      duration = parseFloat(probe.format.duration) || null;
      const videoStream = probe.streams.find((s) => s.codec_type === "video");
      if (videoStream) {
        width = videoStream.width ?? null;
        height = videoStream.height ?? null;
      }
    } catch {
      // non-critical, file still registered
    }

    db.insert(files)
      .values({
        id: fileId,
        sessionId: job.sessionId,
        filename: basename(outputPath),
        path: outputPath,
        size,
        mimeType: `video/${params.format || "mp4"}`,
        duration,
        width,
        height,
      })
      .run();

    db.update(jobs)
      .set({
        status: "completed",
        progress: 100,
        outputFile: fileId,
        completedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, jobId))
      .run();
  } catch (err: any) {
    db.update(jobs)
      .set({
        status: "failed",
        error: err.message,
        completedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, jobId))
      .run();
  }
}
