import { useRef, useEffect, useCallback } from "react";
import { TimelineEngine } from "./TimelineEngine.js";
import type { SpriteMetadata, TimelineState } from "./types.js";

interface Props {
  currentTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  pixelsPerSecond: number;
  scrollOffset: number;
  showTrimRegion: boolean;
  spriteMeta: SpriteMetadata | null;
  spriteImage: HTMLImageElement | null;
  onTimeChange: (time: number) => void;
  onTrimChange: (start: number, end: number) => void;
  onZoomChange: (pps: number) => void;
  onScrollChange: (offset: number) => void;
}

export default function Timeline({
  currentTime,
  duration,
  trimStart,
  trimEnd,
  pixelsPerSecond,
  scrollOffset,
  showTrimRegion,
  spriteMeta,
  spriteImage,
  onTimeChange,
  onTrimChange,
  onZoomChange,
  onScrollChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TimelineEngine | null>(null);

  // Create engine
  useEffect(() => {
    if (!canvasRef.current) return;

    const state: TimelineState = {
      currentTime,
      duration,
      trimStart,
      trimEnd,
      scrollOffset,
      pixelsPerSecond,
      showTrimRegion,
    };

    const engine = new TimelineEngine(canvasRef.current, state, {
      onTimeChange,
      onTrimChange,
      onZoomChange,
      onScrollChange,
    });

    engineRef.current = engine;
    return () => engine.dispose();
  }, []);

  // Sync state changes
  useEffect(() => {
    engineRef.current?.updateState({
      currentTime,
      duration,
      trimStart,
      trimEnd,
      scrollOffset,
      pixelsPerSecond,
      showTrimRegion,
    });
  }, [currentTime, duration, trimStart, trimEnd, scrollOffset, pixelsPerSecond, showTrimRegion]);

  // Sync sprite
  useEffect(() => {
    if (spriteMeta && spriteImage) {
      engineRef.current?.setSprite(spriteMeta, spriteImage);
    }
  }, [spriteMeta, spriteImage]);

  // Pinch-to-zoom via wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = e.clientX - rect.left;
    const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
    engineRef.current?.handlePinch(scaleFactor, centerX);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onWheel={handleWheel}
      className="w-full h-[100px] touch-none select-none"
      style={{ touchAction: "none" }}
    />
  );
}
