import type {
  SpriteMetadata,
  TimelineState,
  HitRegion,
  DragState,
  TimelineCallbacks,
} from "./types.js";

const TRACK_HEIGHT = 60;
const TRIM_HANDLE_WIDTH = 12;
const TRIM_HANDLE_TOUCH = 22; // 44pt / 2
const PLAYHEAD_TRIANGLE = 10;
const RULER_HEIGHT = 20;
const HANDLE_COLOR = "#3b82f6";
const TRIM_OVERLAY = "rgba(59, 130, 246, 0.25)";
const BG_COLOR = "#1e293b";
const RULER_COLOR = "#334155";
const TEXT_COLOR = "#94a3b8";

export class TimelineEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: TimelineState;
  private callbacks: TimelineCallbacks;
  private sprite: HTMLImageElement | null = null;
  private spriteMeta: SpriteMetadata | null = null;
  private drag: DragState = { type: "idle" };
  private needsRender = true;
  private rafId = 0;
  private dpr: number;

  constructor(
    canvas: HTMLCanvasElement,
    state: TimelineState,
    callbacks: TimelineCallbacks
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.state = state;
    this.callbacks = callbacks;
    this.dpr = window.devicePixelRatio || 1;

    this.setupCanvas();
    this.bindEvents();
    this.startLoop();
  }

  private setupCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  }

  resize() {
    this.setupCanvas();
    this.requestRender();
  }

  updateState(partial: Partial<TimelineState>) {
    Object.assign(this.state, partial);
    this.requestRender();
  }

  setSprite(meta: SpriteMetadata, image: HTMLImageElement) {
    this.spriteMeta = meta;
    this.sprite = image;
    this.requestRender();
  }

  private requestRender() {
    this.needsRender = true;
  }

  private startLoop() {
    const loop = () => {
      if (this.needsRender) {
        this.needsRender = false;
        this.render();
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.unbindEvents();
  }

  // --- Coordinate helpers ---

  private get width() {
    return this.canvas.getBoundingClientRect().width;
  }

  private get height() {
    return this.canvas.getBoundingClientRect().height;
  }

  private timeToX(time: number): number {
    return time * this.state.pixelsPerSecond - this.state.scrollOffset;
  }

  private xToTime(x: number): number {
    return (x + this.state.scrollOffset) / this.state.pixelsPerSecond;
  }

  private clampTime(t: number): number {
    return Math.max(0, Math.min(this.state.duration, t));
  }

  // --- Rendering ---

  private render() {
    const { ctx, width: w, height: h, state } = this;
    const { currentTime, duration, trimStart, trimEnd, scrollOffset, pixelsPerSecond } = state;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Track area
    const trackY = RULER_HEIGHT;
    const trackH = TRACK_HEIGHT;

    // Thumbnails
    this.drawThumbnails(0, trackY, w, trackH);

    // Trim overlay — only when trim panel is active
    if (state.showTrimRegion) {
      const trimLeftX = this.timeToX(trimStart);
      const trimRightX = this.timeToX(trimEnd);

      // Dim outside trim region
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      if (trimLeftX > 0) ctx.fillRect(0, trackY, Math.min(trimLeftX, w), trackH);
      if (trimRightX < w) ctx.fillRect(Math.max(trimRightX, 0), trackY, w - Math.max(trimRightX, 0), trackH);

      // Trim region highlight
      ctx.fillStyle = TRIM_OVERLAY;
      ctx.fillRect(
        Math.max(trimLeftX, 0),
        trackY,
        Math.min(trimRightX, w) - Math.max(trimLeftX, 0),
        trackH
      );

      // Trim handles
      this.drawHandle(trimLeftX, trackY, trackH, "left");
      this.drawHandle(trimRightX, trackY, trackH, "right");
    }

    // Ruler
    this.drawRuler();

    // Playhead
    const playheadX = this.timeToX(currentTime);
    this.drawPlayhead(playheadX, trackY, trackH);
  }

  private drawThumbnails(x: number, y: number, w: number, h: number) {
    const { ctx, sprite, spriteMeta, state } = this;
    if (!sprite || !spriteMeta) {
      // Placeholder
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Loading thumbnails...", x + w / 2, y + h / 2 + 4);
      return;
    }

    const { columns, rows, frameWidth, frameHeight, interval, totalFrames } = spriteMeta;
    const visibleStart = Math.max(0, this.xToTime(0));
    const visibleEnd = Math.min(state.duration, this.xToTime(w));

    const startFrame = Math.max(0, Math.floor(visibleStart / interval));
    const endFrame = Math.min(totalFrames - 1, Math.ceil(visibleEnd / interval));

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    for (let i = startFrame; i <= endFrame; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const frameTime = i * interval;
      const dx = this.timeToX(frameTime);
      const dw = this.timeToX(frameTime + interval) - dx;

      ctx.drawImage(
        sprite,
        col * frameWidth, row * frameHeight, frameWidth, frameHeight,
        dx, y, Math.ceil(dw) + 1, h
      );
    }

    ctx.restore();
  }

  private drawHandle(x: number, trackY: number, trackH: number, side: "left" | "right") {
    const { ctx } = this;
    const hx = side === "left" ? x - TRIM_HANDLE_WIDTH / 2 : x - TRIM_HANDLE_WIDTH / 2;

    ctx.fillStyle = HANDLE_COLOR;
    ctx.beginPath();
    ctx.roundRect(Math.max(hx, -TRIM_HANDLE_WIDTH / 2), trackY, TRIM_HANDLE_WIDTH, trackH, 3);
    ctx.fill();

    // Grip lines
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    const cx = Math.max(x, TRIM_HANDLE_WIDTH / 2);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 3, trackY + trackH / 2 - 6);
      ctx.lineTo(cx + i * 3, trackY + trackH / 2 + 6);
      ctx.stroke();
    }
  }

  private drawPlayhead(x: number, trackY: number, trackH: number) {
    const { ctx, width: w } = this;

    // Line
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, RULER_HEIGHT);
    ctx.lineTo(x, RULER_HEIGHT + trackH);
    ctx.stroke();

    // Triangle
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(x - PLAYHEAD_TRIANGLE, RULER_HEIGHT);
    ctx.lineTo(x + PLAYHEAD_TRIANGLE, RULER_HEIGHT);
    ctx.lineTo(x, RULER_HEIGHT + PLAYHEAD_TRIANGLE);
    ctx.closePath();
    ctx.fill();
  }

  private drawRuler() {
    const { ctx, width: w, state } = this;
    const { scrollOffset, pixelsPerSecond, duration } = state;

    ctx.fillStyle = RULER_COLOR;
    ctx.fillRect(0, 0, w, RULER_HEIGHT);

    // Calculate tick interval based on zoom
    let tickInterval: number;
    if (pixelsPerSecond > 200) tickInterval = 1;
    else if (pixelsPerSecond > 50) tickInterval = 5;
    else if (pixelsPerSecond > 10) tickInterval = 10;
    else tickInterval = 30;

    const visibleStart = Math.max(0, Math.floor(this.xToTime(0) / tickInterval) * tickInterval);
    const visibleEnd = Math.min(duration, Math.ceil(this.xToTime(w) / tickInterval) * tickInterval);

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";

    for (let t = visibleStart; t <= visibleEnd; t += tickInterval) {
      const x = this.timeToX(t);

      // Tick mark
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT - 6);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();

      // Label
      const label = this.formatTime(t);
      ctx.fillText(label, x, RULER_HEIGHT - 8);
    }
  }

  private formatTime(secs: number): string {
    if (secs >= 3600) {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // --- Hit testing ---

  private hitTest(x: number, y: number): HitRegion {
    const { state, width: w } = this;
    const trackY = RULER_HEIGHT;
    const trackH = TRACK_HEIGHT;
    const playheadX = this.timeToX(state.currentTime);

    // Playhead (above track)
    if (Math.abs(x - playheadX) < TRIM_HANDLE_TOUCH && y < trackY + PLAYHEAD_TRIANGLE + 5) {
      return { type: "playhead" };
    }

    // Trim handles — only when trim panel is active
    if (state.showTrimRegion && y >= trackY && y <= trackY + trackH) {
      const trimLeftX = this.timeToX(state.trimStart);
      const trimRightX = this.timeToX(state.trimEnd);
      if (Math.abs(x - trimLeftX) < TRIM_HANDLE_TOUCH) {
        return { type: "trim-left" };
      }
      if (Math.abs(x - trimRightX) < TRIM_HANDLE_TOUCH) {
        return { type: "trim-right" };
      }
      if (x > trimLeftX && x < trimRightX) {
        return { type: "trim-body" };
      }
    }

    // General timeline area
    if (y >= trackY && y <= trackY + trackH) {
      return { type: "timeline", time: this.clampTime(this.xToTime(x)) };
    }

    return null;
  }

  private getCursor(hit: HitRegion): string {
    if (!hit) return "default";
    switch (hit.type) {
      case "playhead":
      case "trim-left":
      case "trim-right":
        return "ew-resize";
      case "trim-body":
        return "grab";
      case "timeline":
        return "pointer";
      default:
        return "default";
    }
  }

  // --- Events ---

  private pointerId: number | null = null;

  private bindEvents() {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("resize", this.onResize);
  }

  private unbindEvents() {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("resize", this.onResize);
  }

  private onResize = () => this.resize();

  private getPos(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onPointerDown = (e: PointerEvent) => {
    const { x, y } = this.getPos(e);
    const hit = this.hitTest(x, y);
    const { state } = this;

    this.canvas.setPointerCapture(e.pointerId);
    this.pointerId = e.pointerId;

    switch (hit?.type) {
      case "playhead":
        this.drag = { type: "dragging-playhead" };
        break;
      case "trim-left":
        this.drag = { type: "dragging-trim-left", startTime: state.trimStart };
        break;
      case "trim-right":
        this.drag = { type: "dragging-trim-right", startTime: state.trimEnd };
        break;
      case "trim-body":
        this.drag = {
          type: "dragging-trim-body",
          startTrimStart: state.trimStart,
          startTrimEnd: state.trimEnd,
          startMouseX: x,
        };
        break;
      case "timeline":
        this.drag = { type: "dragging-playhead" };
        this.callbacks.onTimeChange(this.clampTime(hit.time));
        break;
      default:
        this.drag = {
          type: "panning",
          startScrollOffset: state.scrollOffset,
          startMouseX: x,
        };
    }

    e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent) => {
    const { x } = this.getPos(e);
    const { state } = this;

    if (this.drag.type === "idle") {
      const hit = this.hitTest(x, 0);
      this.canvas.style.cursor = this.getCursor(hit);
      return;
    }

    const timeDelta = (e.movementX) / state.pixelsPerSecond;

    switch (this.drag.type) {
      case "dragging-playhead": {
        const newTime = this.clampTime(state.currentTime + timeDelta);
        this.callbacks.onTimeChange(newTime);
        break;
      }
      case "dragging-trim-left": {
        const newStart = Math.max(0, Math.min(state.trimEnd - 0.1, state.trimStart + timeDelta));
        this.callbacks.onTrimChange(newStart, state.trimEnd);
        break;
      }
      case "dragging-trim-right": {
        const newEnd = Math.min(state.duration, Math.max(state.trimStart + 0.1, state.trimEnd + timeDelta));
        this.callbacks.onTrimChange(state.trimStart, newEnd);
        break;
      }
      case "dragging-trim-body": {
        const dx = x - this.drag.startMouseX;
        const dt = dx / state.pixelsPerSecond;
        const trimDuration = this.drag.startTrimEnd - this.drag.startTrimStart;
        let newStart = this.drag.startTrimStart + dt;
        let newEnd = this.drag.startTrimEnd + dt;

        if (newStart < 0) {
          newStart = 0;
          newEnd = trimDuration;
        }
        if (newEnd > state.duration) {
          newEnd = state.duration;
          newStart = state.duration - trimDuration;
        }

        this.callbacks.onTrimChange(newStart, newEnd);
        break;
      }
      case "panning": {
        const dx = x - this.drag.startMouseX;
        const newOffset = Math.max(0, this.drag.startScrollOffset - dx);
        this.callbacks.onScrollChange(newOffset);
        break;
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.pointerId === e.pointerId) {
      this.drag = { type: "idle" };
      this.pointerId = null;
      this.canvas.releasePointerCapture(e.pointerId);
    }
  };

  // Pinch-to-zoom support
  handlePinch(scaleFactor: number, centerX: number) {
    const { state } = this;
    const centerTime = this.xToTime(centerX);
    const newPPS = Math.max(10, Math.min(1200, state.pixelsPerSecond * scaleFactor));

    // Keep center point stable
    const newScrollOffset = centerTime * newPPS - centerX;

    this.callbacks.onZoomChange(newPPS);
    this.callbacks.onScrollChange(Math.max(0, newScrollOffset));
  }
}
