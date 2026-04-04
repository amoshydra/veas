import { useRef, useCallback, useEffect, useState } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  onSeek?: (time: number) => void;
  onSeekEnd?: () => void;
  currentTime?: number;
  formatValue?: (value: number) => string;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
}

export function RangeSlider({
  min,
  max,
  start,
  end,
  onChange,
  onSeek,
  onSeekEnd,
  currentTime,
  formatValue,
  zoomLevel: controlledZoom,
  onZoomChange,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startHandleRef = useRef<HTMLDivElement>(null);
  const endHandleRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'seek' | null>(null);
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const [internalZoom, setInternalZoom] = useState(1.0);
  const [viewCenter, setViewCenter] = useState((min + max) / 2);

  const zoomLevel = controlledZoom ?? internalZoom;
  const setZoomLevel = useCallback((z: number) => {
    if (onZoomChange) {
      onZoomChange(z);
    } else {
      setInternalZoom(z);
    }
  }, [onZoomChange]);

  const clamp = (val: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, val));

  const totalRange = max - min;
  const visibleSpan = totalRange / zoomLevel;
  const rawViewStart = viewCenter - visibleSpan / 2;
  const rawViewEnd = viewCenter + visibleSpan / 2;
  const viewStart = clamp(rawViewStart, min, max - visibleSpan);
  const viewEnd = viewStart + visibleSpan;

  useEffect(() => {
    setViewCenter(clamp(viewCenter, min + visibleSpan / 2, max - visibleSpan / 2));
  }, [min, max, visibleSpan]);

  const pxToValue = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return viewStart;
      const pct = (clientX - rect.left) / rect.width;
      return clamp(viewStart + pct * visibleSpan, min, max);
    },
    [viewStart, visibleSpan, min, max]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!trackRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = trackRef.current.getBoundingClientRect();
      const cursorPct = (e.clientX - rect.left) / rect.width;
      const cursorTime = viewStart + cursorPct * visibleSpan;

      if (e.shiftKey) {
        const delta = visibleSpan * 0.05 * Math.sign(e.deltaY);
        setViewCenter(clamp(viewCenter + delta, min + visibleSpan / 2, max - visibleSpan / 2));
      } else {
        const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newZoom = clamp(zoomLevel * zoomFactor, 1, 600);
        const newVisibleSpan = totalRange / newZoom;

        const cursorOffset = (cursorTime - viewStart) / visibleSpan;
        const newViewStart = cursorTime - cursorOffset * newVisibleSpan;
        const clampedViewStart = clamp(newViewStart, min, max - newVisibleSpan);
        const newViewCenter = clampedViewStart + newVisibleSpan / 2;

        setZoomLevel(newZoom);
        setViewCenter(clamp(newViewCenter, min + newVisibleSpan / 2, max - newVisibleSpan / 2));
      }
    },
    [viewStart, visibleSpan, viewCenter, zoomLevel, totalRange, min, max, setZoomLevel]
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener('wheel', handleWheel, { passive: false });
    return () => track.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent, type: 'start' | 'end') => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(type);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!trackRef.current) return;

      const target = e.target as HTMLElement;
      if (startHandleRef.current?.contains(target)) return;
      if (endHandleRef.current?.contains(target)) return;

      e.preventDefault();
      e.stopPropagation();

      const val = pxToValue(e.clientX);
      if (onSeek) {
        onSeek(val);
      }
      setDragging('seek');
    },
    [pxToValue, onSeek]
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: PointerEvent) => {
      const val = pxToValue(e.clientX);
      if (dragging === 'start') {
        onChange(clamp(val, min, end), end);
      } else if (dragging === 'end') {
        onChange(start, clamp(val, start, max));
      } else if (dragging === 'seek' && onSeek) {
        onSeek(clamp(val, min, max));
      }
    };

    const handleUp = () => {
      const wasDragging = dragging;
      setDragging(null);
      if (wasDragging === 'seek' && onSeekEnd) {
        onSeekEnd();
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, min, max, start, end, onChange, onSeek, onSeekEnd, pxToValue]);

  const timeToPct = useCallback(
    (time: number) => ((time - viewStart) / visibleSpan) * 100,
    [viewStart, visibleSpan]
  );

  const startPct = clamp(timeToPct(start), 0, 100);
  const endPct = clamp(timeToPct(end), 0, 100);
  const currentPct = currentTime != null ? clamp(timeToPct(currentTime), 0, 100) : null;

  const showStartLeft = start < viewStart;
  const showEndRight = end > viewEnd;

  const handleZoomIn = useCallback(() => {
    setZoomLevel(clamp(zoomLevel * 1.5, 1, 600));
  }, [zoomLevel, setZoomLevel]);

  const handleZoomOut = useCallback(() => {
    const newZoom = clamp(zoomLevel / 1.5, 1, 600);
    const newVisibleSpan = totalRange / newZoom;
    setZoomLevel(newZoom);
    setViewCenter(clamp(viewCenter, min + newVisibleSpan / 2, max - newVisibleSpan / 2));
  }, [zoomLevel, setZoomLevel, viewCenter, totalRange, min, max]);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
    setViewCenter((min + max) / 2);
  }, [setZoomLevel, min, max]);

  return (
    <div className="relative w-full select-none">
      <div
        className="relative h-14"
        onPointerMove={(e) => {
          if (!dragging) {
            setHoverValue(pxToValue(e.clientX));
          }
        }}
        onPointerLeave={() => setHoverValue(null)}
      >
        <div
          ref={trackRef}
          className="absolute inset-x-0 top-3 h-8 bg-slate-700 rounded cursor-pointer"
          onPointerDown={handleTrackPointerDown}
        >
          <div
            className="absolute top-0 h-full bg-blue-600/50 rounded"
            style={{
              left: `${clamp(startPct, 0, 100)}%`,
              width: `${clamp(endPct - startPct, 0, 100 - clamp(startPct, 0, 100))}%`,
            }}
          />

          {showStartLeft && (
            <div className="absolute top-0 left-0 h-full w-1 bg-blue-400 rounded-l z-20" />
          )}
          {showEndRight && (
            <div className="absolute top-0 right-0 h-full w-1 bg-blue-400 rounded-r z-20" />
          )}

          {currentPct != null && (
            <div
              className="absolute top-0 w-1 h-full bg-yellow-400 z-10 pointer-events-none rounded-full"
              style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
            />
          )}

          {start >= viewStart && start <= viewEnd && (
            <div
              ref={startHandleRef}
              className="absolute top-0 w-7 h-full bg-blue-400 rounded-md cursor-ew-resize z-30 -ml-3.5 flex items-center justify-center hover:bg-blue-300 active:bg-blue-200 transition-colors touch-none"
              style={{ left: `${startPct}%` }}
              onPointerDown={(e) => handleHandlePointerDown(e, 'start')}
            >
              <div className="flex flex-col gap-0.5">
                <div className="w-0.5 h-2 bg-slate-800 rounded" />
                <div className="w-0.5 h-2 bg-slate-800 rounded" />
                <div className="w-0.5 h-2 bg-slate-800 rounded" />
              </div>
            </div>
          )}

          {end >= viewStart && end <= viewEnd && (
            <div
              ref={endHandleRef}
              className="absolute top-0 w-7 h-full bg-blue-400 rounded-md cursor-ew-resize z-30 -ml-3.5 flex items-center justify-center hover:bg-blue-300 active:bg-blue-200 transition-colors touch-none"
              style={{ left: `${endPct}%` }}
              onPointerDown={(e) => handleHandlePointerDown(e, 'end')}
            >
              <div className="flex flex-col gap-0.5">
                <div className="w-0.5 h-2 bg-slate-800 rounded" />
                <div className="w-0.5 h-2 bg-slate-800 rounded" />
                <div className="w-0.5 h-2 bg-slate-800 rounded" />
              </div>
            </div>
          )}

          {hoverValue != null && !dragging && (
            <div
              className="absolute -top-7 transform -translate-x-1/2 text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded pointer-events-none z-40"
              style={{ left: `${((hoverValue - viewStart) / visibleSpan) * 100}%` }}
            >
              {formatValue ? formatValue(hoverValue) : hoverValue.toFixed(1)}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-slate-500 font-mono">
          {formatValue ? formatValue(viewStart) : viewStart.toFixed(1)}
        </span>
        <div className="flex items-center gap-1">
          {zoomLevel > 1 && (
            <button
              onClick={() => setViewCenter(clamp(viewCenter - visibleSpan * 0.6, min + visibleSpan / 2, max - visibleSpan / 2))}
              className="text-[10px] px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 touch-none"
              title="Pan left"
              onPointerDown={(e) => e.stopPropagation()}
            >
              ◀◀
            </button>
          )}
          <button
            onClick={handleZoomOut}
            className="text-[10px] px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 touch-none"
            title="Zoom out"
            onPointerDown={(e) => e.stopPropagation()}
          >
            −
          </button>
          <span className="text-[10px] text-slate-500 min-w-[40px] text-center">
            {zoomLevel <= 1 ? '1x' : `${zoomLevel.toFixed(0)}x`}
          </span>
          <button
            onClick={handleZoomIn}
            className="text-[10px] px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 touch-none"
            title="Zoom in"
            onPointerDown={(e) => e.stopPropagation()}
          >
            +
          </button>
          {zoomLevel > 1 && (
            <>
              <button
                onClick={() => setViewCenter(clamp(viewCenter + visibleSpan * 0.6, min + visibleSpan / 2, max - visibleSpan / 2))}
                className="text-[10px] px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 touch-none"
                title="Pan right"
                onPointerDown={(e) => e.stopPropagation()}
              >
                ▶▶
              </button>
              <button
                onClick={handleResetZoom}
                className="text-[10px] px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 touch-none ml-1"
                title="Reset zoom"
                onPointerDown={(e) => e.stopPropagation()}
              >
                1x
              </button>
            </>
          )}
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          {formatValue ? formatValue(viewEnd) : viewEnd.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
