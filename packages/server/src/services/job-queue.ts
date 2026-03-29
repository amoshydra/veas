import PQueue from "p-queue";
import { cpus } from "node:os";
import { db } from "../db/index.js";
import { jobs } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { runFfmpeg, generateThumbnail } from "./ffmpeg.js";
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

    db.update(jobs)
      .set({
        status: "completed",
        progress: 100,
        outputFile: outputPath,
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
