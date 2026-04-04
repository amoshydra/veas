import { Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNodeGraphStore } from '../../../stores/nodeGraph.js';
import { RangeSlider } from '../RangeSlider.js';
import { useContextMenu } from './useContextMenu.js';
import { NodeContextMenu } from './NodeContextMenu.js';
import { ResizeHandle } from './ResizeHandle.js';
import { ConnectionHandle } from './ConnectionHandle.js';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return `${String(m).padStart(2, '0')}:${s.padStart(6, '0')}`;
}

function parseTime(str: string): number {
  const parts = str.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(str) || 0;
}

export function TrimNode({ id, data, selected }: NodeProps) {
  const config = (data.config || {}) as Record<string, any>;
  const status = (data.status || 'idle') as string;
  const error = data.error as string | undefined;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frameDuration, setFrameDuration] = useState(1 / 30);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const frameCountRef = useRef(0);
  const lastMediaTimeRef = useRef(0);
  const loopCheckActive = useRef(false);
  const startRef = useRef(config.start ?? 0);
  const endRef = useRef(config.end ?? 10);

  const store = useNodeGraphStore();

  const fileId = config.fileId as string | undefined;

  const statusBorder =
    status === 'completed' ? 'border-green-500' :
    status === 'processing' ? 'border-blue-500' :
    status === 'error' ? 'border-red-500' :
    'border-slate-600';

  const hasFile = !!fileId;

  const start = config.start ?? 0;
  const end = config.end ?? 10;

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  useEffect(() => {
    endRef.current = end;
  }, [end]);

  const updateConfig = useCallback((updates: Record<string, any>) => {
    store.updateNodeConfig(id, updates);
  }, [store, id]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      if (loopEnabled && video.currentTime >= endRef.current) {
        video.currentTime = startRef.current;
      }
      video.play();
      setIsPlaying(true);
    }
  }, [isPlaying, loopEnabled]);

  const stepFrame = useCallback((direction: 1 | -1) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + frameDuration * direction));
  }, [duration, frameDuration]);

  const jumpToStart = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startRef.current;
  }, []);

  const jumpToEnd = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = endRef.current;
  }, []);

  const setTrimStart = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const snappedTime = Math.round(video.currentTime / frameDuration) * frameDuration;
    updateConfig({ start: snappedTime });
  }, [updateConfig, frameDuration]);

  const setTrimEnd = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const snappedTime = Math.round(video.currentTime / frameDuration) * frameDuration;
    updateConfig({ end: snappedTime });
  }, [updateConfig, frameDuration]);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    video.currentTime = time;
    setCurrentTime(time);
    setDragTime(time);
    setIsDraggingSeek(true);
  }, []);

  const handleSeekEnd = useCallback(() => {
    setIsDraggingSeek(false);
    setDragTime(null);
  }, []);

  const handleRangeChange = useCallback((newStart: number, newEnd: number) => {
    const snappedStart = Math.round(newStart / frameDuration) * frameDuration;
    const snappedEnd = Math.round(newEnd / frameDuration) * frameDuration;
    updateConfig({ start: snappedStart, end: snappedEnd });
  }, [updateConfig, frameDuration]);

  const [localStart, setLocalStart] = useState('');
  const [localEnd, setLocalEnd] = useState('');
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalStart(formatTime(start));
    setLocalEnd(formatTime(end));
  }, [start, end]);

  const handleStartBlur = useCallback(() => {
    const time = parseTime(localStart);
    const snappedTime = Math.round(time / frameDuration) * frameDuration;
    const validTime = Math.max(0, Math.min(snappedTime, end));
    updateConfig({ start: validTime });
    setLocalStart(formatTime(validTime));
  }, [localStart, frameDuration, end, updateConfig]);

  const handleEndBlur = useCallback(() => {
    const time = parseTime(localEnd);
    const snappedTime = Math.round(time / frameDuration) * frameDuration;
    const validTime = Math.max(start, Math.min(snappedTime, duration || Infinity));
    updateConfig({ end: validTime });
    setLocalEnd(formatTime(validTime));
  }, [localEnd, frameDuration, start, duration, updateConfig]);

  const handleStartKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleStartBlur();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalStart(formatTime(start));
      e.currentTarget.blur();
    }
  }, [handleStartBlur, start]);

  const handleEndKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleEndBlur();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalEnd(formatTime(end));
      e.currentTarget.blur();
    }
  }, [handleEndBlur, end]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if ((config.end ?? 10) > video.duration) {
        updateConfig({ end: video.duration });
      }
      video.currentTime = start;
      setCurrentTime(start);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [config.end, updateConfig, start]);

  useEffect(() => {
    const rawVideo = videoRef.current;
    if (!rawVideo) return;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const videoEl = rawVideo;
    const hasRFBC = typeof (videoEl as any).requestVideoFrameCallback === 'function';
    let cancelled = false;

    const loop = (_now: number, metadata: any) => {
      if (cancelled) return;

      const t = metadata.mediaTime;
      setCurrentTime(t);

      if (loopEnabled && isPlaying && t >= endRef.current) {
        videoEl.currentTime = startRef.current;
      }

      if (!cancelled) {
        (videoEl as any).requestVideoFrameCallback(loop);
      }
    };

    const onTimeUpdate = () => {
      if (cancelled) return;
      setCurrentTime(videoEl.currentTime);
      if (loopEnabled && isPlaying && videoEl.currentTime >= endRef.current) {
        videoEl.currentTime = startRef.current;
      }
    };

    if (hasRFBC) {
      (videoEl as any).requestVideoFrameCallback(loop);
      loopCheckActive.current = true;
    } else {
      videoEl.addEventListener('timeupdate', onTimeUpdate);
    }

    return () => {
      cancelled = true;
      loopCheckActive.current = false;
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [loopEnabled, isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const onFrame = (now: number, metadata: any) => {
      if (cancelled) return;

      const currentMediaTime = metadata.mediaTime;

      if (frameCountRef.current > 0) {
        const delta = currentMediaTime - lastMediaTimeRef.current;
        if (delta > 0 && delta < 0.1) {
          setFrameDuration(delta);
        }
      }

      lastMediaTimeRef.current = currentMediaTime;
      frameCountRef.current++;

      if (frameCountRef.current < 20 && !cancelled) {
        video.requestVideoFrameCallback(onFrame);
      }
    };

    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback(onFrame);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const { isOpen: menuOpen, toggle: toggleMenu, close: closeMenu, menuRef: contextMenuRef } = useContextMenu();

  return (
    <div
      ref={contextMenuRef}
      className={`rounded-lg border-2 ${statusBorder} bg-slate-800 shadow-lg min-w-[220px] relative ${
        selected ? 'ring-2 ring-blue-400' : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      <ResizeHandle minWidth={220} selected={selected} />
      <ConnectionHandle
        type="target"
        position={Position.Left}
        id="video"
        portType="video"
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-lg">✂️</span>
        <span className="font-semibold text-sm flex-1">Trim</span>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); toggleMenu(); }}
            className="text-slate-400 hover:text-slate-200 p-1 rounded"
            title="More options"
          >
            <span className="text-xs">⋮</span>
          </button>
          {menuOpen && (
            <NodeContextMenu
              nodeId={id}
              onDelete={(nodeId) => { store.removeNode(nodeId); closeMenu(); }}
              onClose={closeMenu}
            />
          )}
        </div>
        {status === 'completed' && <span className="text-xs text-green-400">✓</span>}
        {status === 'processing' && <span className="text-xs text-blue-400 animate-pulse">●</span>}
        {status === 'error' && <span className="text-xs text-red-400">✗</span>}
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {!hasFile && (
        <div className="px-3 py-2 text-xs text-slate-400 cursor-default">
          <span>Connect an input to preview</span>
        </div>
      )}

      {hasFile && (
        <div className="nodrag cursor-default px-3 py-2 space-y-3">
          <video
            ref={videoRef}
            src={`/api/files/${fileId}`}
            className="w-full rounded bg-black"
            playsInline
            preload="metadata"
          />

          <div className="text-center text-[10px] text-slate-400 font-mono">
            {formatTime(dragTime ?? currentTime)} / {formatTime(duration)}
          </div>

          <RangeSlider
            min={0}
            max={duration || 1}
            start={start}
            end={end}
            onChange={handleRangeChange}
            onSeek={handleSeek}
            onSeekEnd={handleSeekEnd}
            currentTime={dragTime ?? currentTime}
            formatValue={formatTime}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
          />

          <div className="flex items-center justify-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); jumpToStart(); }}
              className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              title="Jump to A"
            >
              ⏮
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); stepFrame(-1); }}
              className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              title="Previous frame"
            >
              ◀
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
              className="text-[10px] px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); stepFrame(1); }}
              className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              title="Next frame"
            >
              ▶
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); jumpToEnd(); }}
              className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              title="Jump to B"
            >
              ⏭
            </button>
          </div>

          <div className="flex items-center justify-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setTrimStart(); }}
              className="text-[10px] px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white"
              title="Set current time as start (A)"
            >
              Set A
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setTrimEnd(); }}
              className="text-[10px] px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white"
              title="Set current time as end (B)"
            >
              Set B
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setLoopEnabled(!loopEnabled); }}
              className={`text-[10px] px-2 py-1 rounded ${loopEnabled ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              title={loopEnabled ? 'Loop ON' : 'Loop OFF'}
            >
              🔁 {loopEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); updateConfig({ start: Math.max(0, currentTime), end: Math.min(currentTime + 3, duration || 10) }); }}
              className="text-[10px] px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-slate-200"
              title="Trim 3 seconds from current position"
            >
              Trim 3s
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); updateConfig({ start: Math.max(0, currentTime), end: Math.min(currentTime + 5, duration || 10) }); }}
              className="text-[10px] px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-slate-200"
              title="Trim 5 seconds from current position"
            >
              Trim 5s
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); updateConfig({ start: Math.max(0, currentTime), end: Math.min(currentTime + 10, duration || 10) }); }}
              className="text-[10px] px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-slate-200"
              title="Trim 10 seconds from current position"
            >
              Trim 10s
            </button>
          </div>

          <div className="flex items-center justify-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); updateConfig({ start: Math.max(0, start - 1) }); }}
              className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              title="Move start 1 second earlier"
            >
              A−1s
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); updateConfig({ start: Math.min(start + 1, end - 0.1) }); }}
              className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              title="Move start 1 second later"
            >
              A+1s
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); updateConfig({ end: Math.max(end - 1, start + 0.1) }); }}
              className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              title="Move end 1 second earlier"
            >
              B−1s
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); updateConfig({ end: Math.min(end + 1, duration || Infinity) }); }}
              className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              title="Move end 1 second later"
            >
              B+1s
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Start (A)</label>
              <input
                ref={startInputRef}
                type="text"
                value={localStart}
                onChange={(e) => { e.stopPropagation(); setLocalStart(e.target.value); }}
                onBlur={(e) => { e.stopPropagation(); handleStartBlur(); }}
                onKeyDown={(e) => { e.stopPropagation(); handleStartKeyDown(e); }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 font-mono focus:border-blue-500 focus:outline-none"
                placeholder="00:00.000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">End (B)</label>
              <input
                ref={endInputRef}
                type="text"
                value={localEnd}
                onChange={(e) => { e.stopPropagation(); setLocalEnd(e.target.value); }}
                onBlur={(e) => { e.stopPropagation(); handleEndBlur(); }}
                onKeyDown={(e) => { e.stopPropagation(); handleEndKeyDown(e); }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 font-mono focus:border-blue-500 focus:outline-none"
                placeholder="00:10.000"
              />
            </div>
          </div>

          <div className="text-[10px] text-slate-500 text-center">
            Duration: {formatTime(end - start)} · Frame: {(1 / frameDuration).toFixed(0)}fps
          </div>
        </div>
      )}

      <ConnectionHandle
        type="source"
        position={Position.Right}
        id="video"
        portType="video"
      />
    </div>
  );
}
