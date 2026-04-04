import { EventEmitter } from "node:events";

class ProgressEmitter extends EventEmitter {}

export const progressBus = new ProgressEmitter();

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
  type: 'nodeStart' | 'nodeComplete' | 'nodeError';
  pipelineId: string;
  nodeId: string;
  status: string;
  outputFile?: string;
  cachePath?: string;
  error?: string;
}

export function emitPipelineEvent(event: PipelineEvent) {
  progressBus.emit(`pipeline:${event.pipelineId}`, event);
}
