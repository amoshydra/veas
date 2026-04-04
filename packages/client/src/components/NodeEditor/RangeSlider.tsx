import { useRef, useCallback, useEffect, useState } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  onSeek?: (time: number) => void;
  currentTime?: number;
  formatValue?: (value: number) => string;
}

export function RangeSlider({
  min,
  max,
  start,
  end,
  onChange,
  onSeek,
  currentTime,
  formatValue,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startHandleRef = useRef<HTMLDivElement>(null);
  const endHandleRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'seek' | null>(null);
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const clamp = (val: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, val));

  const pxToValue = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return min;
      const pct = (clientX - rect.left) / rect.width;
      return clamp(min + pct * (max - min), min, max);
    },
    [min, max]
  );

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

    const handleUp = () => setDragging(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, min, max, start, end, onChange, onSeek, pxToValue]);

  const startPct = ((start - min) / (max - min)) * 100;
  const endPct = ((end - min) / (max - min)) * 100;
  const currentPct = currentTime != null ? ((currentTime - min) / (max - min)) * 100 : null;

  return (
    <div
      className="relative w-full h-14 select-none"
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
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />

        {currentPct != null && (
          <div
            className="absolute top-0 w-1 h-full bg-yellow-400 z-10 pointer-events-none rounded-full"
            style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
          />
        )}

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

        {hoverValue != null && !dragging && (
          <div
            className="absolute -top-7 transform -translate-x-1/2 text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded pointer-events-none z-40"
            style={{ left: `${((hoverValue - min) / (max - min)) * 100}%` }}
          >
            {formatValue ? formatValue(hoverValue) : hoverValue.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}
