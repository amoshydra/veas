import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { jobs } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { enqueueJob, getQueueStats } from "../services/job-queue.js";
import { progressBus } from "../services/progress.js";

const jobsRoute = new Hono();

jobsRoute.post("/", async (c) => {
  const body = await c.req.json();
  const id = uuidv4();

  db.insert(jobs)
    .values({
      id,
      sessionId: body.sessionId,
      operation: body.operation,
      params: JSON.stringify(body.params || {}),
      inputFiles: JSON.stringify(body.inputFiles || []),
      status: "queued",
    })
    .run();

  enqueueJob(id);

  const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
  return c.json(job, 201);
});

jobsRoute.get("/", (c) => {
  const sessionId = c.req.query("sessionId");
  const status = c.req.query("status");

  let results = db.select().from(jobs).all();
  if (sessionId) results = results.filter((j) => j.sessionId === sessionId);
  if (status) results = results.filter((j) => j.status === status);

  return c.json(results);
});

jobsRoute.get("/:id", (c) => {
  const job = db
    .select()
    .from(jobs)
    .where(eq(jobs.id, c.req.param("id")))
    .get();
  if (!job) return c.json({ error: "Job not found" }, 404);
  return c.json(job);
});

jobsRoute.get("/:id/stream", async (c) => {
  const jobId = c.req.param("id");

  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) return c.json({ error: "Job not found" }, 404);

  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        // Send current state immediately
        if (job.status === "completed") {
          send("complete", { outputPath: job.outputFile });
          controller.close();
          return;
        }
        if (job.status === "failed") {
          send("error", { error: job.error });
          controller.close();
          return;
        }

        send("status", { status: job.status, progress: job.progress });

        const onProgress = (data: unknown) => send("progress", data);
        const onComplete = (data: unknown) => {
          send("complete", data);
          cleanup();
          controller.close();
        };
        const onError = (data: unknown) => {
          send("error", data);
          cleanup();
          controller.close();
        };

        const cleanup = () => {
          progressBus.off(`progress:${jobId}`, onProgress);
          progressBus.off(`complete:${jobId}`, onComplete);
          progressBus.off(`error:${jobId}`, onError);
        };

        progressBus.on(`progress:${jobId}`, onProgress);
        progressBus.on(`complete:${jobId}`, onComplete);
        progressBus.on(`error:${jobId}`, onError);

        c.req.raw.signal.addEventListener("abort", cleanup);
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    },
  );
});

jobsRoute.delete("/:id", (c) => {
  const jobId = c.req.param("id");
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) return c.json({ error: "Job not found" }, 404);

  if (job.status === "processing" || job.status === "queued") {
    db.update(jobs)
      .set({ status: "cancelled", completedAt: new Date().toISOString() })
      .where(eq(jobs.id, jobId))
      .run();
  }

  return c.json({ ok: true });
});

jobsRoute.get("/queue/stats", (c) => {
  return c.json(getQueueStats());
});

export default jobsRoute;
