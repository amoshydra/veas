import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { jobs, files, nodeGraphs } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { statSync, mkdirSync } from "node:fs";
import { basename } from "node:path";
import { runFfmpeg, generateThumbnail, ffprobe } from "./ffmpeg.js";
import { buildFfmpegArgs } from "./operations.js";
import { emitProgress } from "./progress.js";

interface PipelineNode {
  id: string;
  type: string;
  config: Record<string, any>;
}

interface PipelineConnection {
  id: string;
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
}

interface ResolvedNode {
  node: PipelineNode;
  inputs: string[];
  order: number;
}

function topologicalSort(
  nodes: PipelineNode[],
  connections: PipelineConnection[]
): ResolvedNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDegree = new Map(nodes.map(n => [n.id, 0]));
  const adjacency = new Map<string, string[]>();

  for (const conn of connections) {
    if (!adjacency.has(conn.fromNode)) adjacency.set(conn.fromNode, []);
    adjacency.get(conn.fromNode)!.push(conn.toNode);
    inDegree.set(conn.toNode, (inDegree.get(conn.toNode) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const sorted: ResolvedNode[] = [];
  let order = 0;

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const inputConns = connections.filter(c => c.toNode === nodeId);
    sorted.push({
      node,
      inputs: inputConns.map(c => c.fromNode),
      order: order++,
    });

    for (const next of adjacency.get(nodeId) || []) {
      inDegree.set(next, (inDegree.get(next) || 0) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error("Graph contains cycles");
  }

  return sorted;
}

async function executeNode(
  node: PipelineNode,
  inputFilePaths: string[],
  params: Record<string, any>,
  sessionId: string,
  jobId: string
): Promise<string> {
  mkdirSync(`./data/output/${sessionId}`, { recursive: true });

  if (node.type === "thumbnail") {
    const outputPath = `./data/output/${sessionId}/${jobId}_output.jpg`;
    await generateThumbnail(
      inputFilePaths[0],
      outputPath,
      params.timestamp || "00:00:01"
    );
    return outputPath;
  }

  const args = buildFfmpegArgs(node.type, inputFilePaths, params);
  const outputPath = `./data/output/${sessionId}/${jobId}_output.${params.format || "mp4"}`;

  await runFfmpeg({ jobId, args, outputPath });

  return outputPath;
}

export async function executePipeline(
  sessionId: string,
  nodes: PipelineNode[],
  connections: PipelineConnection[]
): Promise<{ pipelineId: string; jobs: Array<{ nodeId: string; jobId: string; status: string; outputFile?: string }> }> {
  const pipelineId = uuidv4();
  const sortedNodes = topologicalSort(nodes, connections);
  const nodeOutputs = new Map<string, string>();
  const jobResults: Array<{ nodeId: string; jobId: string; status: string; outputFile?: string }> = [];

  mkdirSync(`./data/output/${sessionId}`, { recursive: true });

  for (const resolved of sortedNodes) {
    const { node, inputs } = resolved;
    const jobId = uuidv4();

    if (node.type === "input") {
      if (!node.config.fileId) {
        throw new Error(`Input node ${node.id} has no file selected`);
      }

      const fileRecord = db.select().from(files).where(eq(files.id, node.config.fileId)).get();
      if (!fileRecord) {
        throw new Error(`File ${node.config.fileId} not found`);
      }

      nodeOutputs.set(node.id, fileRecord.path);

      db.insert(jobs)
        .values({
          id: jobId,
          sessionId,
          operation: "input",
          params: JSON.stringify(node.config),
          status: "completed",
          progress: 100,
          inputFiles: JSON.stringify([]),
          outputFile: fileRecord.id,
          pipelineId,
          nodeId: node.id,
        })
        .run();

      jobResults.push({ nodeId: node.id, jobId, status: "completed", outputFile: fileRecord.id });
      continue;
    }

    if (node.type === "output") {
      const inputNodeId = inputs[0];
      const inputFilePath = nodeOutputs.get(inputNodeId);
      if (!inputFilePath) {
        throw new Error(`No input for output node ${node.id}`);
      }

      const inputFilePaths = [inputFilePath];

      db.insert(jobs)
        .values({
          id: jobId,
          sessionId,
          operation: "output",
          params: JSON.stringify(node.config),
          status: "queued",
          progress: 0,
          inputFiles: JSON.stringify(inputFilePaths),
          pipelineId,
          nodeId: node.id,
        })
        .run();

      try {
        db.update(jobs)
          .set({ status: "processing", progress: 0 })
          .where(eq(jobs.id, jobId))
          .run();

        const outputPath = await executeNode(
          node,
          inputFilePaths,
          node.config,
          sessionId,
          jobId
        );

        const fileId = uuidv4();
        let duration: number | null = null;
        let width: number | null = null;
        let height: number | null = null;
        let size = 0;

        try {
          size = statSync(outputPath).size;
          const probe = await ffprobe(outputPath);
          duration = parseFloat(probe.format.duration) || null;
          const videoStream = probe.streams.find((s: any) => s.codec_type === "video");
          if (videoStream) {
            width = (videoStream as any).width ?? null;
            height = (videoStream as any).height ?? null;
          }
        } catch { /* non-critical */ }

        db.insert(files)
          .values({
            id: fileId,
            sessionId,
            filename: basename(outputPath),
            path: outputPath,
            size,
            mimeType: `video/${node.config.format || "mp4"}`,
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

        nodeOutputs.set(node.id, outputPath);
        jobResults.push({ nodeId: node.id, jobId, status: "completed", outputFile: fileId });
      } catch (err: any) {
        db.update(jobs)
          .set({
            status: "failed",
            error: err.message,
            completedAt: new Date().toISOString(),
          })
          .where(eq(jobs.id, jobId))
          .run();

        jobResults.push({ nodeId: node.id, jobId, status: "failed" });
        throw new Error(`Pipeline failed at node ${node.id}: ${err.message}`);
      }
      continue;
    }

    const inputFilePaths: string[] = [];
    for (const inputNodeId of inputs) {
      const path = nodeOutputs.get(inputNodeId);
      if (!path) {
        throw new Error(`No input path for node ${inputNodeId}`);
      }
      inputFilePaths.push(path);
    }

    db.insert(jobs)
      .values({
        id: jobId,
        sessionId,
        operation: node.type,
        params: JSON.stringify(node.config),
        status: "queued",
        progress: 0,
        inputFiles: JSON.stringify(inputFilePaths),
        pipelineId,
        nodeId: node.id,
      })
      .run();

    try {
      db.update(jobs)
        .set({ status: "processing", progress: 0 })
        .where(eq(jobs.id, jobId))
        .run();

      const outputPath = await executeNode(
        node,
        inputFilePaths,
        node.config,
        sessionId,
        jobId
      );

      const fileId = uuidv4();
      let duration: number | null = null;
      let width: number | null = null;
      let height: number | null = null;
      let size = 0;

      try {
        size = statSync(outputPath).size;
        const probe = await ffprobe(outputPath);
        duration = parseFloat(probe.format.duration) || null;
        const videoStream = probe.streams.find((s: any) => s.codec_type === "video");
        if (videoStream) {
          width = (videoStream as any).width ?? null;
          height = (videoStream as any).height ?? null;
        }
      } catch { /* non-critical */ }

      db.insert(files)
        .values({
          id: fileId,
          sessionId,
          filename: basename(outputPath),
          path: outputPath,
          size,
          mimeType: `video/${node.config.format || "mp4"}`,
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

      nodeOutputs.set(node.id, outputPath);
      jobResults.push({ nodeId: node.id, jobId, status: "completed", outputFile: fileId });
    } catch (err: any) {
      db.update(jobs)
        .set({
          status: "failed",
          error: err.message,
          completedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, jobId))
        .run();

      jobResults.push({ nodeId: node.id, jobId, status: "failed" });
      throw new Error(`Pipeline failed at node ${node.id}: ${err.message}`);
    }
  }

  return { pipelineId, jobs: jobResults };
}
