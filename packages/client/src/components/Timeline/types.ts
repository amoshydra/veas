export interface SpriteMetadata {
  spriteUrl: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  interval: number;
  totalFrames: number;
}

export interface TimelineState {
  currentTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  scrollOffset: number;
  pixelsPerSecond: number;
}

export type HitRegion =
  | { type: "playhead" }
  | { type: "trim-left" }
  | { type: "trim-right" }
  | { type: "trim-body" }
  | { type: "timeline"; time: number }
  | null;

export type DragState =
  | { type: "idle" }
  | { type: "dragging-playhead" }
  | { type: "dragging-trim-left"; startTime: number }
  | { type: "dragging-trim-right"; startTime: number }
  | { type: "dragging-trim-body"; startTrimStart: number; startTrimEnd: number; startMouseX: number }
  | { type: "panning"; startScrollOffset: number; startMouseX: number };

export interface TimelineCallbacks {
  onTimeChange: (time: number) => void;
  onTrimChange: (start: number, end: number) => void;
  onZoomChange: (pixelsPerSecond: number) => void;
  onScrollChange: (scrollOffset: number) => void;
}
