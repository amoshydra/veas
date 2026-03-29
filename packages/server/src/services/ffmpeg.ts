import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { emitProgress, emitComplete, emitError } from "./progress.js";

export interface FfprobeResult {
  format: {
    filename: string;
    duration: string;
    size: string;
    bit_rate: string;
    format_name: string;
  };
  streams: Array<{
    index: number;
    codec_type: string;
    codec_name: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    bit_rate?: string;
    duration?: string;
  }>;
}

export function ffprobe(filePath: string): Promise<FfprobeResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath,
    ]);

    let stdout = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", () => {});

    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exited with code ${code}`));
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error("Failed to parse ffprobe output"));
      }
    });

    proc.on("error", reject);
  });
}

export interface FfmpegOptions {
  jobId: string;
  args: string[];
  outputPath: string;
}

export function runFfmpeg({ jobId, args, outputPath }: FfmpegOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const fullArgs = [...args, "-y", outputPath];
    const proc = spawn("ffmpeg", fullArgs);

    let durationSeconds = 0;

    proc.stderr.on("data", (data: Buffer) => {
      const line = data.toString();

      const durationMatch = line.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
      if (durationMatch && !durationSeconds) {
        durationSeconds =
          parseInt(durationMatch[1]) * 3600 +
          parseInt(durationMatch[2]) * 60 +
          parseInt(durationMatch[3]) +
          parseInt(durationMatch[4]) / 100;
      }

      const timeMatch = line.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      if (timeMatch && durationSeconds > 0) {
        const currentSeconds =
          parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseInt(timeMatch[3]) +
          parseInt(timeMatch[4]) / 100;
        const percent = Math.min(100, (currentSeconds / durationSeconds) * 100);

        const frameMatch = line.match(/frame=\s*(\d+)/);
        const fpsMatch = line.match(/fps=\s*([\d.]+)/);
        const speedMatch = line.match(/speed=\s*([\d.]+)x/);
        const bitrateMatch = line.match(/bitrate=\s*([\d.]+[kMG]?bits\/s)/);
        const sizeMatch = line.match(/size=\s*([\d.]+[kMG]?B)/);

        emitProgress({
          jobId,
          percent: Math.round(percent * 10) / 10,
          frame: frameMatch ? parseInt(frameMatch[1]) : undefined,
          fps: fpsMatch ? parseFloat(fpsMatch[1]) : undefined,
          time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}` : undefined,
          speed: speedMatch ? `${speedMatch[1]}x` : undefined,
          bitrate: bitrateMatch ? bitrateMatch[1] : undefined,
          size: sizeMatch ? sizeMatch[1] : undefined,
        });
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        emitComplete(jobId, { outputPath });
        resolve(outputPath);
      } else {
        const msg = `ffmpeg exited with code ${code}`;
        emitError(jobId, msg);
        reject(new Error(msg));
      }
    });

    proc.on("error", (err) => {
      emitError(jobId, err.message);
      reject(err);
    });
  });
}

export function generateThumbnail(
  inputPath: string,
  outputPath: string,
  timestamp = "00:00:01"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const proc = spawn("ffmpeg", [
      "-i", inputPath,
      "-ss", timestamp,
      "-vframes", "1",
      "-vf", "scale=320:-1",
      "-y",
      outputPath,
    ]);

    proc.on("close", (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`Thumbnail generation failed with code ${code}`));
    });

    proc.on("error", reject);
  });
}
