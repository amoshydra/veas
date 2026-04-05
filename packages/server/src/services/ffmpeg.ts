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
      "-v",
      "quiet",
      "-print_format",
      "json",
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
      } catch {
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
    let errorOutput = "";

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

      if (line.includes("Error") || line.includes("error") || line.includes("Invalid")) {
        errorOutput += line;
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        emitComplete(jobId, { outputPath });
        resolve(outputPath);
      } else {
        const ffmpegCmd = `ffmpeg ${fullArgs.join(" ")}`;
        let msg = `ffmpeg exited with code ${code}`;
        if (errorOutput) {
          const errorLines = errorOutput.split("\n").filter((l) => l.trim());
          msg += `\nFFmpeg error: ${errorLines.join("\n")}`;

          if (errorOutput.includes("moov atom not found")) {
            msg +=
              "\n\nTip: The input file is incomplete or corrupted. This often means the source file was not fully uploaded or was interrupted.";
          } else if (errorOutput.includes("Invalid data found when processing input")) {
            msg +=
              "\n\nTip: The input file format is invalid or unsupported. Check if the file is a valid media file.";
          } else if (errorOutput.includes("Duration:")) {
            msg +=
              "\n\nTip: Could not detect input duration. The input file may be empty or unreadable.";
          }
        }
        msg += `\nCommand: ${ffmpegCmd}`;
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
  timestamp = "00:00:01",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const proc = spawn("ffmpeg", [
      "-i",
      inputPath,
      "-ss",
      timestamp,
      "-vframes",
      "1",
      "-vf",
      "scale=320:-1",
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

export interface SpriteResult {
  spritePath: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  interval: number;
  totalFrames: number;
}

export function generateSpriteSheet(
  inputPath: string,
  outputPath: string,
  duration: number,
  options: { interval?: number; frameWidth?: number; columns?: number } = {},
): Promise<SpriteResult> {
  return new Promise((resolve, reject) => {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const interval = options.interval ?? 2;
    const frameWidth = options.frameWidth ?? 160;
    const columns = options.columns ?? 10;
    const totalFrames = Math.max(1, Math.ceil(duration / interval));
    const rows = Math.ceil(totalFrames / columns);

    // Generate sprite: extract 1 frame every N seconds, tile into grid
    const proc = spawn("ffmpeg", [
      "-i",
      inputPath,
      "-vf",
      `fps=1/${interval},scale=${frameWidth}:-1,tile=${columns}x${rows}`,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      "-y",
      outputPath,
    ]);

    proc.on("close", (code) => {
      if (code === 0) {
        // Calculate actual frame height from aspect ratio (approximate)
        const frameHeight = Math.round((frameWidth * 9) / 16); // assume 16:9
        resolve({
          spritePath: outputPath,
          frameWidth,
          frameHeight,
          columns,
          rows,
          interval,
          totalFrames,
        });
      } else {
        reject(new Error(`Sprite generation failed with code ${code}`));
      }
    });

    proc.on("error", reject);
  });
}
