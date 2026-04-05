import { EventEmitter } from "node:events";

class ProgressEmitter extends EventEmitter {}

export const progressBus = new ProgressEmitter();

const pipelineEventQueues = new Map<string, PipelineEvent[]>();

export function queuePipelineEvent(event: PipelineEvent) {
  const queue = pipelineEventQueues.get(event.pipelineId) || [];
  queue.push(event);
  pipelineEventQueues.set(event.pipelineId, queue);
}

export function getQueuedEvents(pipelineId: string): PipelineEvent[] {
  const queue = pipelineEventQueues.get(pipelineId) || [];
  pipelineEventQueues.delete(pipelineId);
  return queue;
}

export interface JobProgress {
  jobId: string;
  percent: number;
  frame?: number;
  fps?: number;
  time?: string;
  speed?: string;
  bitrate?: string;
  size?: string;
}

export function emitProgress(progress: JobProgress) {
  progressBus.emit(`progress:${progress.jobId}`, progress);
}

export function emitComplete(jobId: string, data: Record<string, unknown>) {
  progressBus.emit(`complete:${jobId}`, data);
}

export function emitError(jobId: string, error: string) {
  progressBus.emit(`error:${jobId}`, { error });
}

export interface PipelineEvent {
  type: "nodeStart" | "nodeComplete" | "nodeError";
  pipelineId: string;
  nodeId: string;
  status: string;
  outputFile?: string;
  cachePath?: string;
  error?: string;
}

export function emitPipelineEvent(event: PipelineEvent) {
  queuePipelineEvent(event);
  progressBus.emit(`pipeline:${event.pipelineId}`, event);
}
