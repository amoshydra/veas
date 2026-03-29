function normalizeTime(time: string): string {
  // Handle plain seconds: "10" or "10.5"
  if (/^\d+(\.\d+)?$/.test(time)) {
    const secs = parseFloat(time);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
  }

  // Handle "MM:SS.mmm" format: "00:10.123" or "1:30.5"
  if (/^\d{1,2}:\d{1,2}(\.\d+)?$/.test(time)) {
    const parts = time.split(":");
    const totalMins = parseInt(parts[0]);
    const s = parseFloat(parts[1]);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
  }

  // Handle "H:MM:SS" format: "0:00:10" or "1:23:45"
  const match = time.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (match) {
    const h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const s = parseFloat(match[3]);
    if (h > 0) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
  }

  return time;
}

function timeToSeconds(time: string): number {
  // Plain seconds
  if (/^\d+(\.\d+)?$/.test(time)) return parseFloat(time);

  // M:SS
  if (/^\d{1,2}:\d{1,2}(\.\d+)?$/.test(time)) {
    const [m, s] = time.split(":");
    return parseInt(m) * 60 + parseFloat(s);
  }

  // H:MM:SS
  const match = time.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (match) {
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
  }

  return 0;
}

export function buildFfmpegArgs(
  operation: string,
  inputFiles: string[],
  params: Record<string, any>
): string[] {
  const format = params.format || "mp4";

  switch (operation) {
    case "trim": {
      const args: string[] = [];
      if (params.start) args.push("-ss", normalizeTime(String(params.start)));
      args.push("-i", inputFiles[0]);
      if (params.end && params.start) {
        const duration = timeToSeconds(String(params.end)) - timeToSeconds(String(params.start));
        if (duration > 0) args.push("-t", String(duration));
      } else if (params.end) {
        args.push("-to", normalizeTime(String(params.end)));
      }
      args.push("-c:v", "libx264", "-preset", params.preset || "medium");
      args.push("-c:a", "aac");
      return args;
    }

    case "crop": {
      const { width, height, x, y } = params;
      return [
        "-i", inputFiles[0],
        "-vf", `crop=${width}:${height}:${x || 0}:${y || 0}`,
        "-c:v", "libx264", "-preset", params.preset || "medium",
        "-c:a", "copy",
      ];
    }

    case "concat": {
      const listPath = params.listPath || "/tmp/concat.txt";
      return [
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c", "copy",
      ];
    }

    case "transcode": {
      const codec = params.codec || "libx264";
      const crf = params.crf ?? 23;
      const preset = params.preset || "medium";
      const args = ["-i", inputFiles[0]];

      if (["libx264", "libx265"].includes(codec)) {
        args.push("-c:v", codec, "-crf", String(crf), "-preset", preset);
      } else if (codec === "libvpx-vp9") {
        args.push("-c:v", codec, "-crf", String(crf), "-b:v", "0");
      } else {
        args.push("-c:v", codec);
      }

      args.push("-c:a", params.audioCodec || "aac");
      if (params.resolution) {
        args.push("-vf", `scale=${params.resolution}`);
      }
      return args;
    }

    case "resize": {
      const scale = params.width
        ? `scale=${params.width}:-2`
        : params.height
        ? `scale=-2:${params.height}`
        : `scale=${params.scale}`;
      return [
        "-i", inputFiles[0],
        "-vf", scale,
        "-c:v", "libx264", "-preset", params.preset || "medium",
        "-c:a", "copy",
      ];
    }

    case "filter": {
      const filters: string[] = [];
      if (params.brightness != null) filters.push(`brightness=${params.brightness}`);
      if (params.contrast != null) filters.push(`contrast=${params.contrast}`);
      if (params.saturation != null) filters.push(`saturation=${params.saturation}`);
      if (params.blur) filters.push(`boxblur=${params.blur}`);
      if (params.sharpen) filters.push(`unsharp=${params.sharpen}`);
      if (params.grayscale) filters.push("format=gray");
      if (params.sepia) filters.push("colorbalance=bs=0.2:gs=-0.1:rs=-0.1");
      if (params.vignette) filters.push("vignette=PI/4");
      return [
        "-i", inputFiles[0],
        "-vf", filters.join(",") || "copy",
        "-c:v", "libx264", "-preset", params.preset || "medium",
        "-c:a", "copy",
      ];
    }

    case "gif": {
      const fps = params.fps || 10;
      const scale = params.width ? `scale=${params.width}:-1:flags=lanczos` : "scale=480:-1:flags=lanczos";
      return [
        "-i", inputFiles[0],
        "-vf", `${fps < 60 ? `fps=${fps},` : ""}${scale},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
        "-loop", "0",
      ];
    }

    case "speed": {
      const speed = params.speed || 1;
      const ptsFilter = `setpts=${1 / speed}*PTS`;
      const atempoFilter = speed > 2
        ? `atempo=${Math.sqrt(speed)},atempo=${Math.sqrt(speed)}`
        : `atempo=${speed}`;
      return [
        "-i", inputFiles[0],
        "-vf", ptsFilter,
        "-af", atempoFilter,
        "-c:v", "libx264", "-preset", params.preset || "medium",
      ];
    }

    case "audio-extract": {
      return [
        "-i", inputFiles[0],
        "-vn",
        "-c:a", params.audioCodec || "libmp3lame",
        "-q:a", String(params.quality || 2),
      ];
    }

    case "watermark": {
      const pos = params.position || "bottom-right";
      const overlay: Record<string, string> = {
        "top-left": "10:10",
        "top-right": "W-w-10:10",
        "bottom-left": "10:H-h-10",
        "bottom-right": "W-w-10:H-h-10",
        "center": "(W-w)/2:(H-h)/2",
      };
      return [
        "-i", inputFiles[0],
        "-i", inputFiles[1],
        "-filter_complex", `overlay=${overlay[pos] || overlay["bottom-right"]}`,
      ];
    }

    case "rotate": {
      const angle = params.angle || 90;
      const transposeMap: Record<number, string> = {
        90: "transpose=1",
        180: "transpose=2,transpose=2",
        270: "transpose=2",
      };
      return [
        "-i", inputFiles[0],
        "-vf", transposeMap[angle] || "transpose=1",
        "-c:a", "copy",
      ];
    }

    case "flip": {
      const vf = params.direction === "vertical" ? "vflip" : "hflip";
      return ["-i", inputFiles[0], "-vf", vf, "-c:a", "copy"];
    }

    case "reverse": {
      const args = ["-i", inputFiles[0], "-vf", "reverse"];
      if (!params.videoOnly) args.push("-af", "areverse");
      return args;
    }

    case "loop": {
      return [
        "-stream_loop", String(params.count || 2),
        "-i", inputFiles[0],
        "-c", "copy",
      ];
    }

    case "subtitle": {
      return [
        "-i", inputFiles[0],
        "-vf", `subtitles=${params.subtitlePath}`,
        "-c:v", "libx264", "-preset", params.preset || "medium",
        "-c:a", "copy",
      ];
    }

    case "pip": {
      const x = params.x || 10;
      const y = params.y || 10;
      const w = params.width || 320;
      return [
        "-i", inputFiles[0],
        "-i", inputFiles[1],
        "-filter_complex", `[1:v]scale=${w}:-1[pip];[0:v][pip]overlay=${x}:${y}`,
        "-c:a", "copy",
      ];
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}
