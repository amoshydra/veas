import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNodeGraphStore } from '../../../stores/nodeGraph.js';
import { RangeSlider } from '../RangeSlider.js';

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
  const [showPreview, setShowPreview] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frameDuration, setFrameDuration] = useState(1 / 30);
  const [loopEnabled, setLoopEnabled] = useState(true);
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
  }, []);

  const handleRangeChange = useCallback((newStart: number, newEnd: number) => {
    const snappedStart = Math.round(newStart / frameDuration) * frameDuration;
    const snappedEnd = Math.round(newEnd / frameDuration) * frameDuration;
    updateConfig({ start: snappedStart, end: snappedEnd });
  }, [updateConfig, frameDuration]);

  const handleStartInputChange = useCallback((value: string) => {
    const time = parseTime(value);
    const snappedTime = Math.round(time / frameDuration) * frameDuration;
    updateConfig({ start: Math.max(0, Math.min(snappedTime, end)) });
  }, [updateConfig, frameDuration, end]);

  const handleEndInputChange = useCallback((value: string) => {
    const time = parseTime(value);
    const snappedTime = Math.round(time / frameDuration) * frameDuration;
    updateConfig({ end: Math.max(start, Math.min(snappedTime, duration || Infinity)) });
  }, [updateConfig, frameDuration, start, duration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showPreview) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if ((config.end ?? 10) > video.duration) {
        updateConfig({ end: video.duration });
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [showPreview, config.end, updateConfig]);

  useEffect(() => {
    const rawVideo = videoRef.current;
    if (!rawVideo || !showPreview) return;

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
  }, [showPreview, loopEnabled, isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showPreview) return;

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
  }, [showPreview]);

  return (
    <div
      className={`rounded-lg border-2 ${statusBorder} bg-slate-800 shadow-lg min-w-[220px] ${
        selected ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <NodeResizer
        minWidth={220}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="bg-blue-400 w-2 h-2"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        className="!w-3 !h-3 !rounded-full bg-blue-400 !border-2 !border-slate-900"
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-lg">✂️</span>
        <span className="font-semibold text-sm flex-1">Trim</span>
        {hasFile && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowPreview(!showPreview); }}
            className="text-xs text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-700"
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            {showPreview ? '▲' : '▼'}
          </button>
        )}
        {status === 'completed' && <span className="text-xs text-green-400">✓</span>}
        {status === 'processing' && <span className="text-xs text-blue-400 animate-pulse">●</span>}
        {status === 'error' && <span className="text-xs text-red-400">✗</span>}
      </div>

      {!showPreview && (
        <div className="px-3 py-2 text-xs text-slate-400 cursor-default">
          {error ? (
            <div className="text-red-400 truncate">{error}</div>
          ) : (
            <span>{formatTime(start)} → {formatTime(end)}</span>
          )}
        </div>
      )}

      {hasFile && showPreview && (
        <div className="nodrag cursor-default px-3 py-2 space-y-3">
          <video
            ref={videoRef}
            src={`/api/files/${fileId}`}
            className="w-full rounded bg-black"
            playsInline
            preload="metadata"
            style={{ maxHeight: '120px' }}
          />

          <div className="text-center text-[10px] text-slate-400 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <RangeSlider
            min={0}
            max={duration || 1}
            start={start}
            end={end}
            onChange={handleRangeChange}
            onSeek={handleSeek}
            currentTime={currentTime}
            formatValue={formatTime}
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

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Start (A)</label>
              <input
                type="text"
                value={formatTime(start)}
                onChange={(e) => handleStartInputChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 font-mono focus:border-blue-500 focus:outline-none"
                placeholder="00:00.000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">End (B)</label>
              <input
                type="text"
                value={formatTime(end)}
                onChange={(e) => handleEndInputChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
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

      <Handle
        type="source"
        position={Position.Right}
        id="video"
        className="!w-3 !h-3 !rounded-full bg-blue-400 !border-2 !border-slate-900"
      />
    </div>
  );
}
