import { useCallback, useEffect, useRef, useState } from "react";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropOverlayProps {
  videoWidth: number;
  videoHeight: number;
  displayWidth: number;
  displayHeight: number;
  crop: CropRect;
  onCropChange: (crop: CropRect) => void;
  aspectRatio?: number | null;
}

type DragMode = "move" | "create" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function _applyAspectRatio(
  crop: CropRect,
  aspect: number,
  mode: DragMode,
  videoWidth: number,
  videoHeight: number,
): CropRect {
  const newHeight = crop.width / aspect;
  const newY = crop.y + (crop.height - newHeight) / 2;

  return {
    x: clamp(crop.x, 0, videoWidth - crop.width),
    y: clamp(newY, 0, videoHeight - newHeight),
    width: clamp(crop.width, 10, videoWidth),
    height: clamp(newHeight, 10, videoHeight),
  };
}

function applyAspectRatioFromEdges(
  crop: CropRect,
  aspect: number,
  mode: DragMode,
  videoWidth: number,
  videoHeight: number,
): CropRect {
  if (
    mode === "w" ||
    mode === "e" ||
    mode === "nw" ||
    mode === "ne" ||
    mode === "sw" ||
    mode === "se"
  ) {
    const newHeight = crop.width / aspect;
    let newY = crop.y;
    if (mode === "nw" || mode === "ne") {
      newY = crop.y + (crop.height - newHeight);
    } else {
      newY = crop.y + (crop.height - newHeight) / 2;
    }
    return {
      x: clamp(crop.x, 0, videoWidth - crop.width),
      y: clamp(newY, 0, videoHeight - newHeight),
      width: clamp(crop.width, 10, videoWidth),
      height: clamp(newHeight, 10, videoHeight),
    };
  }
  if (mode === "n" || mode === "s") {
    const newWidth = crop.height * aspect;
    const newX = crop.x + (crop.width - newWidth) / 2;
    return {
      x: clamp(newX, 0, videoWidth - newWidth),
      y: clamp(crop.y, 0, videoHeight - crop.height),
      width: clamp(newWidth, 10, videoWidth),
      height: clamp(crop.height, 10, videoHeight),
    };
  }
  return crop;
}

const _CURSOR_MAP: Record<string, string> = {
  nw: "nw-resize",
  n: "n-resize",
  ne: "ne-resize",
  e: "e-resize",
  se: "se-resize",
  s: "s-resize",
  sw: "sw-resize",
  w: "w-resize",
  move: "move",
};

export function CropOverlay({
  videoWidth,
  videoHeight,
  displayWidth,
  displayHeight,
  crop,
  onCropChange,
  aspectRatio,
}: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragCropStart, setDragCropStart] = useState<CropRect | null>(null);
  const [hoverMode, setHoverMode] = useState<DragMode>(null);

  const scaleX = displayWidth / videoWidth;
  const scaleY = displayHeight / videoHeight;

  const toDisplay = useCallback(
    (p: { x: number; y: number }) => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
    }),
    [scaleX, scaleY],
  );

  const toVideo = useCallback(
    (p: { x: number; y: number }) => ({
      x: p.x / scaleX,
      y: p.y / scaleY,
    }),
    [scaleX, scaleY],
  );

  const getRelativePos = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const pos = getRelativePos(e);
      const videoPos = toVideo(pos);

      if (!hoverMode) {
        setDragMode("create");
        const snapped = {
          x: clamp(Math.round(videoPos.x), 0, videoWidth - 10),
          y: clamp(Math.round(videoPos.y), 0, videoHeight - 10),
          width: 0,
          height: 0,
        };
        setDragStart({ x: snapped.x, y: snapped.y });
        setDragCropStart(snapped);
      } else {
        setDragMode(hoverMode);
        setDragStart({ x: videoPos.x, y: videoPos.y });
        setDragCropStart({ ...crop });
      }
    },
    [hoverMode, crop, getRelativePos, toVideo, videoWidth, videoHeight],
  );

  useEffect(() => {
    if (!dragMode || !dragCropStart) return;

    const container = containerRef.current;
    if (!container) return;

    const handleMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const pos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const videoPos = toVideo(pos);
      const dx = videoPos.x - dragStart.x;
      const dy = videoPos.y - dragStart.y;

      let newCrop: CropRect;

      if (dragMode === "create") {
        const startX = dragCropStart.x;
        const startY = dragCropStart.y;
        let endX = clamp(Math.round(videoPos.x), 0, videoWidth);
        let endY = clamp(Math.round(videoPos.y), 0, videoHeight);

        newCrop = {
          x: Math.min(startX, endX),
          y: Math.min(startY, endY),
          width: Math.abs(endX - startX),
          height: Math.abs(endY - startY),
        };

        if (aspectRatio && newCrop.width > 10) {
          const constrainedHeight = Math.round(newCrop.width / aspectRatio);
          const growDown = endY >= startY;
          newCrop.height = Math.min(constrainedHeight, videoHeight - newCrop.y);
          if (!growDown) {
            newCrop.y = Math.max(0, newCrop.y + newCrop.height - constrainedHeight);
            newCrop.height = constrainedHeight;
          }
        }
      } else if (dragMode === "move") {
        newCrop = {
          x: clamp(Math.round(dragCropStart.x + dx), 0, videoWidth - dragCropStart.width),
          y: clamp(Math.round(dragCropStart.y + dy), 0, videoHeight - dragCropStart.height),
          width: dragCropStart.width,
          height: dragCropStart.height,
        };
      } else {
        newCrop = { ...dragCropStart };

        if (dragMode.includes("w")) {
          const newX = clamp(
            Math.round(dragCropStart.x + dx),
            0,
            dragCropStart.x + dragCropStart.width - 10,
          );
          newCrop.width = dragCropStart.width - (newX - dragCropStart.x);
          newCrop.x = newX;
        }
        if (dragMode.includes("e")) {
          newCrop.width = clamp(
            Math.round(dragCropStart.width + dx),
            10,
            videoWidth - dragCropStart.x,
          );
        }
        if (dragMode.includes("n")) {
          const newY = clamp(
            Math.round(dragCropStart.y + dy),
            0,
            dragCropStart.y + dragCropStart.height - 10,
          );
          newCrop.height = dragCropStart.height - (newY - dragCropStart.y);
          newCrop.y = newY;
        }
        if (dragMode.includes("s")) {
          newCrop.height = clamp(
            Math.round(dragCropStart.height + dy),
            10,
            videoHeight - dragCropStart.y,
          );
        }
      }

      if (aspectRatio && dragMode !== "create" && dragMode !== "move") {
        newCrop = applyAspectRatioFromEdges(
          newCrop,
          aspectRatio,
          dragMode,
          videoWidth,
          videoHeight,
        );
      }

      onCropChange(newCrop);
    };

    const handleUp = () => {
      setDragMode(null);
      setDragCropStart(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [
    dragMode,
    dragStart,
    dragCropStart,
    toVideo,
    onCropChange,
    videoWidth,
    videoHeight,
    aspectRatio,
  ]);

  const handleEdgeHover = useCallback((mode: DragMode, e: React.PointerEvent) => {
    e.stopPropagation();
    setHoverMode(mode);
  }, []);

  const handleEdgeLeave = useCallback(() => {
    if (!dragMode) setHoverMode(null);
  }, [dragMode]);

  const displayCrop = toDisplay({ x: crop.x, y: crop.y });
  const displayCropSize = toDisplay({ x: crop.width, y: crop.height });

  const handleSize = 10;
  const borderColor = "rgba(59, 130, 246, 0.9)";
  const _handleColor = "rgb(59, 130, 246)";

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={(e) => {
        if (!dragMode) {
          const pos = getRelativePos(e);
          const videoPos = toVideo(pos);
          const insideCrop =
            videoPos.x >= crop.x &&
            videoPos.x <= crop.x + crop.width &&
            videoPos.y >= crop.y &&
            videoPos.y <= crop.y + crop.height;
          if (!insideCrop && !hoverMode) {
            setHoverMode(null);
          }
        }
      }}
      onPointerLeave={() => {
        if (!dragMode) setHoverMode(null);
      }}
    >
      {/* Dim overlay for areas outside crop */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${displayWidth} ${displayHeight}`}
      >
        <defs>
          <mask id="cropMask">
            <rect
              width="100%"
              height="100%"
              fill="white"
            />
            <rect
              x={displayCrop.x}
              y={displayCrop.y}
              width={displayCropSize.x}
              height={displayCropSize.y}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.5)"
          mask="url(#cropMask)"
        />
      </svg>

      {/* Crop border */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: displayCrop.x,
          top: displayCrop.y,
          width: displayCropSize.x,
          height: displayCropSize.y,
          border: `2px solid ${borderColor}`,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
        }}
      >
        {/* Grid lines (rule of thirds) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
        </div>

        {/* Move handle (inner area) */}
        <div
          className="absolute inset-0 cursor-move"
          onPointerDown={(e) => {
            e.stopPropagation();
            handleEdgeHover("move", e);
            handlePointerDown(e);
          }}
          onPointerLeave={handleEdgeLeave}
        />

        {/* Corner handles */}
        <div
          className="absolute bg-blue-500 rounded-full border-2 border-white cursor-nw-resize"
          style={{
            width: handleSize,
            height: handleSize,
            left: -handleSize / 2,
            top: -handleSize / 2,
          }}
          onPointerDown={(e) => {
            handleEdgeHover("nw", e);
            handlePointerDown(e);
          }}
          onPointerLeave={handleEdgeLeave}
        />
        <div
          className="absolute bg-blue-500 rounded-full border-2 border-white cursor-ne-resize"
          style={{
            width: handleSize,
            height: handleSize,
            right: -handleSize / 2,
            top: -handleSize / 2,
          }}
          onPointerDown={(e) => {
            handleEdgeHover("ne", e);
            handlePointerDown(e);
          }}
          onPointerLeave={handleEdgeLeave}
        />
        <div
          className="absolute bg-blue-500 rounded-full border-2 border-white cursor-sw-resize"
          style={{
            width: handleSize,
            height: handleSize,
            left: -handleSize / 2,
            bottom: -handleSize / 2,
          }}
          onPointerDown={(e) => {
            handleEdgeHover("sw", e);
            handlePointerDown(e);
          }}
          onPointerLeave={handleEdgeLeave}
        />
        <div
          className="absolute bg-blue-500 rounded-full border-2 border-white cursor-se-resize"
          style={{
            width: handleSize,
            height: handleSize,
            right: -handleSize / 2,
            bottom: -handleSize / 2,
          }}
          onPointerDown={(e) => {
            handleEdgeHover("se", e);
            handlePointerDown(e);
          }}
          onPointerLeave={handleEdgeLeave}
        />

        {/* Edge handles */}
        <div
          className="absolute bg-blue-400 rounded-full border border-white cursor-n-resize"
          style={{
            width: handleSize,
            height: handleSize,
            left: "50%",
            top: -handleSize / 2,
            marginLeft: -handleSize / 2,
          }}
          onPointerDown={(e) => {
            handleEdgeHover("n", e);
            handlePointerDown(e);
          }}
          onPointerLeave={handleEdgeLeave}
        />
        <div
          className="absolute bg-blue-400 rounded-full border border-white cursor-s-resize"
          style={{
            width: handleSize,
            height: handleSize,
            left: "50%",
            bottom: -handleSize / 2,
            marginLeft: -handleSize / 2,
          }}
          onPointerDown={(e) => {
            handleEdgeHover("s", e);
            handlePointerDown(e);
          }}
          onPointerLeave={handleEdgeLeave}
        />
        <div
          className="absolute bg-blue-400 rounded-full border border-white cursor-w-resize"
          style={{
            width: handleSize,
            height: handleSize,
            left: -handleSize / 2,
            top: "50%",
            marginTop: -handleSize / 2,
          }}
          onPointerDown={(e) => {
            handleEdgeHover("w", e);
            handlePointerDown(e);
          }}
          onPointerLeave={handleEdgeLeave}
        />
        <div
          className="absolute bg-blue-400 rounded-full border border-white cursor-e-resize"
          style={{
            width: handleSize,
            height: handleSize,
            right: -handleSize / 2,
            top: "50%",
            marginTop: -handleSize / 2,
          }}
          onPointerDown={(e) => {
            handleEdgeHover("e", e);
            handlePointerDown(e);
          }}
          onPointerLeave={handleEdgeLeave}
        />
      </div>

      {/* Dimension label */}
      <div
        className="absolute text-[10px] text-white bg-blue-600 px-1.5 py-0.5 rounded pointer-events-none font-mono"
        style={{
          left: displayCrop.x + displayCropSize.x / 2,
          top: displayCrop.y + displayCropSize.y + 6,
          transform: "translateX(-50%)",
        }}
      >
        {Math.round(crop.width)}×{Math.round(crop.height)}
      </div>
    </div>
  );
}
