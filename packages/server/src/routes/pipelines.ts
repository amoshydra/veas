import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { nodeGraphs, jobs } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { executePipeline } from "../services/pipeline.js";
import { progressBus } from "../services/progress.js";
import type { PipelineEvent } from "../services/progress.js";

const pipelinesRoute = new Hono();

pipelinesRoute.post("/execute", async (c) => {
  const body = await c.req.json();
  const { sessionId, nodes, connections } = body;

  if (!sessionId || !nodes || !connections) {
    return c.json({ error: "Missing required fields: sessionId, nodes, connections" }, 400);
  }

  const pipelineId = uuidv4();

  // Start pipeline in background, return immediately
  executePipeline(sessionId, nodes, connections, pipelineId).catch((err) => {
    console.error("Pipeline error:", err.message);
  });

  // Update node graph
  const existing = db
    .select()
    .from(nodeGraphs)
    .where(eq(nodeGraphs.sessionId, sessionId))
    .get();

  if (existing) {
    db.update(nodeGraphs)
      .set({
        nodes: JSON.stringify(nodes),
        connections: JSON.stringify(connections),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(nodeGraphs.id, existing.id))
      .run();
  } else {
    db.insert(nodeGraphs)
      .values({
        id: uuidv4(),
        sessionId,
        nodes: JSON.stringify(nodes),
        connections: JSON.stringify(connections),
      })
      .run();
  }

  return c.json({ pipelineId }, 200);
});

pipelinesRoute.get("/stream/:pipelineId", async (c) => {
  const pipelineId = c.req.param("pipelineId");

  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        const onEvent = (data: PipelineEvent) => {
          send(data.type, data);
          if (data.type === "nodeError") {
            cleanup();
            controller.close();
          }
        };

        const cleanup = () => {
          progressBus.off(`pipeline:${pipelineId}`, onEvent);
        };

        progressBus.on(`pipeline:${pipelineId}`, onEvent);
        c.req.raw.signal.addEventListener("abort", cleanup);
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }
  );
});

pipelinesRoute.post("/save", async (c) => {
  const body = await c.req.json();
  const { sessionId, nodes, connections, viewport, name } = body;

  if (!sessionId) {
    return c.json({ error: "Missing sessionId" }, 400);
  }

  const existing = db
    .select()
    .from(nodeGraphs)
    .where(eq(nodeGraphs.sessionId, sessionId))
    .get();

  if (existing) {
    db.update(nodeGraphs)
      .set({
        nodes: JSON.stringify(nodes || []),
        connections: JSON.stringify(connections || []),
        viewport: JSON.stringify(viewport || {}),
        name: name || existing.name,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(nodeGraphs.id, existing.id))
      .run();

    const updated = db
      .select()
      .from(nodeGraphs)
      .where(eq(nodeGraphs.id, existing.id))
      .get();
    return c.json(updated);
  }

  const id = uuidv4();
  db.insert(nodeGraphs)
    .values({
      id,
      sessionId,
      name: name || "Untitled",
      nodes: JSON.stringify(nodes || []),
      connections: JSON.stringify(connections || []),
      viewport: JSON.stringify(viewport || {}),
    })
    .run();

  const created = db.select().from(nodeGraphs).where(eq(nodeGraphs.id, id)).get();
  return c.json(created, 201);
});

pipelinesRoute.get("/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId");

  const graph = db
    .select()
    .from(nodeGraphs)
    .where(eq(nodeGraphs.sessionId, sessionId))
    .get();

  if (!graph) {
    return c.json({ nodes: [], connections: [], viewport: {} });
  }

  return c.json({
    ...graph,
    nodes: JSON.parse(graph.nodes),
    connections: JSON.parse(graph.connections),
    viewport: JSON.parse(graph.viewport),
  });
});

pipelinesRoute.get("/pipeline/:pipelineId/stream", async (c) => {
  const pipelineId = c.req.param("pipelineId");

  const pipelineJobs = db
    .select()
    .from(jobs)
    .where(eq(jobs.pipelineId as any, pipelineId))
    .all();

  if (!pipelineJobs.length) {
    return c.json({ error: "Pipeline not found" }, 404);
  }

  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        const completedJobs = pipelineJobs.filter((j) => j.status === "completed");
        const failedJobs = pipelineJobs.filter((j) => j.status === "failed");

        if (failedJobs.length > 0) {
          send("error", { pipelineId, error: failedJobs[0].error });
          controller.close();
          return;
        }

        if (completedJobs.length === pipelineJobs.length) {
          send("complete", {
            pipelineId,
            jobs: pipelineJobs.map((j) => ({
              nodeId: j.nodeId,
              jobId: j.id,
              status: j.status,
              outputFile: j.outputFile,
            })),
          });
          controller.close();
          return;
        }

        send("status", {
          pipelineId,
          total: pipelineJobs.length,
          completed: completedJobs.length,
          jobs: pipelineJobs.map((j) => ({
            nodeId: j.nodeId,
            jobId: j.id,
            status: j.status,
            progress: j.progress,
            outputFile: j.outputFile,
          })),
        });

        const listeners: Array<{ jobId: string; event: string; fn: (data: unknown) => void }> = [];

        for (const job of pipelineJobs) {
          if (job.status !== "completed" && job.status !== "failed") {
            const onProgress = (data: unknown) => send("progress", data);
            const onComplete = (data: unknown) => {
              send("nodeComplete", { ...(data as Record<string, unknown>), nodeId: job.nodeId, jobId: job.id });
              const allDone = db
                .select()
                .from(jobs)
                .where(eq(jobs.pipelineId as any, pipelineId))
                .all()
                .filter((j) => j.status === "completed" || j.status === "failed");

              if (allDone.length === pipelineJobs.length) {
                const failed = allDone.filter((j) => j.status === "failed");
                if (failed.length > 0) {
                  send("error", { pipelineId, error: failed[0].error });
                } else {
                  send("complete", {
                    pipelineId,
                    jobs: allDone.map((j) => ({
                      nodeId: j.nodeId,
                      jobId: j.id,
                      status: j.status,
                      outputFile: j.outputFile,
                    })),
                  });
                }
                cleanup();
                controller.close();
              }
            };
            const onError = (data: unknown) => {
              send("error", { ...(data as Record<string, unknown>), nodeId: job.nodeId, jobId: job.id, pipelineId });
              cleanup();
              controller.close();
            };

            listeners.push(
              { jobId: job.id, event: `progress:${job.id}`, fn: onProgress },
              { jobId: job.id, event: `complete:${job.id}`, fn: onComplete },
              { jobId: job.id, event: `error:${job.id}`, fn: onError }
            );

            progressBus.on(`progress:${job.id}`, onProgress);
            progressBus.on(`complete:${job.id}`, onComplete);
            progressBus.on(`error:${job.id}`, onError);
          }
        }

        const cleanup = () => {
          for (const l of listeners) {
            progressBus.off(l.event, l.fn);
          }
        };

        c.req.raw.signal.addEventListener("abort", cleanup);
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }
  );
});

export default pipelinesRoute;
