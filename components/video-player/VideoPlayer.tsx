"use client";

import { useWatchLayout } from "@/components/watch-layout";
import {
  fusedDuration,
  fusedToReal,
  realToFused,
  spanAfter,
  type FusedSpan,
} from "@/lib/fused-timeline";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Maximize,
  MessageSquare,
  MessageSquareOff,
  Minimize,
  Pause,
  Play,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type SyntheticEvent as ReactSyntheticEvent,
} from "react";
import { Controls } from "./controls";
import { PLAYBACK_SPEEDS, SettingsMenu, type PlaybackSpeed } from "./settings-menu";
import { TransportLive } from "./transport-live";
import { ElapsedTime, TransportVod } from "./transport-vod";
import { isLiveSource, type PlayerSource } from "./types";
import { useMediaSource } from "./use-media-source";
import { useVideoState } from "./use-video-state";
import { VolumeControl } from "./volume-control";

export type SeekRequest = { seconds: number; id: number };

export type VideoPlayerProps = {
  source: PlayerSource;
  width?: number | null;
  height?: number | null;
  className?: string;
  containerClassName?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onDimensions?: (width: number, height: number) => void;
  onResize?: (width: number) => void;
  seekRequest?: SeekRequest | null;
  // An ordered set of spans within the source. Given one, only those spans play, in
  // order, and the transport measures the fused piece rather than the whole source.
  spans?: FusedSpan[] | null;
  children?: ReactNode;
};

const SEEK_STEP_SECONDS = 5;
const CONTROLS_AUTOHIDE_MS = 2500;
const DEFAULT_RATIO = 16 / 9;

function isVertical(
  width: number | null | undefined,
  height: number | null | undefined
): boolean {
  if (!width || !height) {
    return false;
  }
  return height > width;
}

function isSpeed(value: number): value is PlaybackSpeed {
  return (PLAYBACK_SPEEDS as readonly number[]).includes(value);
}

export function VideoPlayer({
  source,
  width,
  height,
  className,
  containerClassName,
  onTimeUpdate,
  onDimensions,
  onResize,
  seekRequest,
  spans,
  children,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const seekRequestIdRef = useRef<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [intrinsic, setIntrinsic] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const layout = useWatchLayout();
  const live = isLiveSource(source);
  const media = useMediaSource(videoRef, source);
  const state = useVideoState(videoRef, containerRef, {
    live,
    liveSyncRef: media.liveSyncRef,
  });

  const vertical = intrinsic
    ? isVertical(intrinsic.width, intrinsic.height)
    : isVertical(width, height);

  // Sizing follows the frame's own shape rather than forcing 16:9, so a 4:3 or
  // ultrawide video is letterboxed instead of having its edges cut off.
  const ratio = intrinsic
    ? intrinsic.width / intrinsic.height
    : width && height
      ? width / height
      : DEFAULT_RATIO;

  // A live source arrives muted so autoplay is allowed at all.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !live) {
      return;
    }
    video.muted = true;
    void video.play().catch(() => {});
  }, [live, source.src]);

  // Held stable against its own contents, so a caller passing a fresh array each
  // render does not restart the piece on every render.
  const fusedKey = spans
    ? spans.map((span) => `${span.startS}-${span.endS}`).join(",")
    : "";
  const fused = useMemo(
    () => (spans && spans.length > 0 ? spans : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fusedKey]
  );
  const fusedTotal = fused ? fusedDuration(fused) : 0;

  // Entering a fused piece, or changing which one, starts at its beginning.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !fused) {
      return;
    }
    const first = fusedToReal(fused, 0);
    if (first) {
      video.currentTime = first.realS;
    }
  }, [fused]);

  // The playhead is nudged forward at each seam. Nothing is buffered or re-encoded:
  // playing a thread is seeking past the stream time between its spans.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !fused) {
      return;
    }
    const follow = () => {
      const current = video.currentTime;
      const inside = fused.some(
        (span) => current >= span.startS && current < span.endS
      );
      if (inside) {
        return;
      }
      const next = spanAfter(fused, current);
      if (next === null) {
        video.pause();
        const last = fused[fused.length - 1];
        if (last && current > last.endS) {
          video.currentTime = last.endS;
        }
        return;
      }
      video.currentTime = fused[next].startS;
    };
    video.addEventListener("timeupdate", follow);
    video.addEventListener("seeked", follow);
    return () => {
      video.removeEventListener("timeupdate", follow);
      video.removeEventListener("seeked", follow);
    };
  }, [fused]);

  const resizeCallbackRef = useRef(onResize);
  useEffect(() => {
    resizeCallbackRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !resizeCallbackRef.current) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        resizeCallbackRef.current?.(rect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleLoadedMetadata = useCallback(
    (e: ReactSyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0) {
        setIntrinsic({ width: w, height: h });
        onDimensions?.(w, h);
      }
    },
    [onDimensions]
  );

  const handleTimeUpdate = useCallback(
    (e: ReactSyntheticEvent<HTMLVideoElement>) => {
      onTimeUpdate?.(e.currentTarget.currentTime);
    },
    [onTimeUpdate]
  );

  useEffect(() => {
    if (!seekRequest) {
      return;
    }
    if (seekRequestIdRef.current === seekRequest.id) {
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }
    seekRequestIdRef.current = seekRequest.id;
    const duration = Number.isFinite(video.duration) ? video.duration : null;
    const target = Math.max(
      0,
      duration === null ? seekRequest.seconds : Math.min(seekRequest.seconds, duration)
    );
    video.currentTime = target;
  }, [seekRequest]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        setControlsVisible(false);
      }
    }, CONTROLS_AUTOHIDE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const handlePlay = useCallback(() => {
    showControls();
  }, [showControls]);

  const handlePause = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused || video.ended) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (!Number.isFinite(time)) {
      return;
    }
    const max = Number.isFinite(video.duration) ? video.duration : time;
    video.currentTime = Math.max(0, Math.min(time, max));
  }, []);

  // The transport works in fused time when a span set is given, so the seek bar
  // measures the piece being reviewed rather than the whole source.
  const seekTransport = useCallback(
    (time: number) => {
      if (!fused) {
        seek(time);
        return;
      }
      const target = fusedToReal(fused, Math.max(0, Math.min(time, fusedTotal)));
      if (target) {
        seek(target.realS);
      }
    },
    [fused, fusedTotal, seek]
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      if (!fused) {
        seek(video.currentTime + deltaSeconds);
        return;
      }
      const at = realToFused(fused, video.currentTime) ?? 0;
      seekTransport(at + deltaSeconds);
    },
    [fused, seek, seekTransport]
  );

  const jumpToLive = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const edge =
      media.liveSyncRef.current ??
      (video.seekable.length > 0
        ? video.seekable.end(video.seekable.length - 1)
        : null);
    if (edge === null || !Number.isFinite(edge)) {
      return;
    }
    video.currentTime = edge;
    void video.play().catch(() => {});
  }, [media.liveSyncRef]);

  const setVolume = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const clamped = Math.max(0, Math.min(1, value));
    video.volume = clamped;
    if (clamped > 0 && video.muted) {
      video.muted = false;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.muted = !video.muted;
  }, []);

  const unmute = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.muted = false;
    video.volume = 1;
    void video.play().catch(() => {});
  }, []);

  const setPlaybackRate = useCallback((rate: PlaybackSpeed) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.playbackRate = rate;
  }, []);

  // Fullscreen targets the stage when there is one, so the chat can overlay the
  // video instead of being left outside the fullscreen element.
  const layoutFullscreen = layout?.toggleFullscreen;
  const toggleFullscreen = useCallback(() => {
    if (layoutFullscreen) {
      layoutFullscreen();
      return;
    }
    const target = containerRef.current;
    if (!target) {
      return;
    }
    if (document.fullscreenElement === target) {
      void document.exitFullscreen().catch((error) => {
        console.error(error);
      });
    } else {
      void target.requestFullscreen().catch((error) => {
        console.error(error);
      });
    }
  }, [layoutFullscreen]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target !== containerRef.current &&
        target.closest("input, textarea, button, [role='slider']")
      ) {
        return;
      }
      switch (e.key) {
        case " ":
        case "Spacebar":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          showControls();
          break;
        case "ArrowLeft":
          if (!state.seekable) {
            return;
          }
          e.preventDefault();
          seekBy(-SEEK_STEP_SECONDS);
          showControls();
          break;
        case "ArrowRight":
          if (!state.seekable) {
            return;
          }
          e.preventDefault();
          seekBy(SEEK_STEP_SECONDS);
          showControls();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          showControls();
          break;
        default:
          return;
      }
    },
    [
      seekBy,
      showControls,
      state.seekable,
      togglePlay,
      toggleFullscreen,
      toggleMute,
    ]
  );

  const handleVideoClick = useCallback(
    (e: ReactMouseEvent<HTMLVideoElement>) => {
      e.preventDefault();
      togglePlay();
    },
    [togglePlay]
  );

  const handlePlaybackRateChange = useCallback(
    (value: PlaybackSpeed) => {
      if (!isSpeed(value)) {
        return;
      }
      setPlaybackRate(value);
    },
    [setPlaybackRate]
  );

  const isFullscreen = layout ? layout.mode === "fullscreen" : state.isFullscreen;
  const showChatToggle = !!layout && isFullscreen && layout.chatAvailable;

  const transportTime = fused
    ? realToFused(fused, state.currentTime) ?? 0
    : state.currentTime;
  const transportDuration = fused ? fusedTotal : state.duration;
  const transportBuffered = fused
    ? realToFused(fused, state.buffered) ?? transportTime
    : state.buffered;

  // Where each section hands over to the next, so the seek bar reads as the
  // pieces it is made of while still scrubbing continuously across them.
  const transportSegments = useMemo(() => {
    if (!fused || fused.length < 2) {
      return undefined;
    }
    const boundaries: number[] = [];
    let consumed = 0;
    for (const span of fused.slice(0, -1)) {
      consumed += Math.max(0, span.endS - span.startS);
      boundaries.push(consumed);
    }
    return boundaries;
  }, [fused]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label="Video player"
      onKeyDown={handleKeyDown}
      onMouseMove={showControls}
      onMouseLeave={() => {
        const video = videoRef.current;
        if (video && !video.paused) {
          setControlsVisible(false);
        }
      }}
      style={{ aspectRatio: ratio }}
      className={cn(
        "group/player relative isolate mx-auto w-full overflow-hidden rounded-lg bg-black outline-none focus-visible:ring-2 focus-visible:ring-primary",
        vertical && "max-w-[min(420px,calc(80vh*9/16))]",
        isFullscreen && "max-h-full",
        containerClassName,
        className
      )}
    >
      <video
        ref={videoRef}
        poster={source.kind === "mp4" ? source.poster : undefined}
        playsInline
        preload="metadata"
        onClick={handleVideoClick}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handlePause}
        className="h-full w-full bg-black object-contain"
      />

      {children}

      {state.buffering && !state.error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-white/80" />
        </div>
      )}

      {state.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black p-6 text-center text-white">
          <p className="text-sm font-medium">{state.error}</p>
          <p className="text-xs text-white/60">
            {live ? "Waiting for the stream to resume." : "Try reloading the page."}
          </p>
        </div>
      )}

      {live && state.muted && (
        <button
          type="button"
          onClick={unmute}
          className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:bg-black"
        >
          <VolumeX className="h-4 w-4" />
          Tap to unmute
        </button>
      )}

      <Controls
        visible={controlsVisible}
        transport={
          state.seekable ? (
            <TransportVod
              currentTime={transportTime}
              duration={transportDuration}
              buffered={transportBuffered}
              onSeek={seekTransport}
              segments={transportSegments}
            />
          ) : null
        }
        left={
          <>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={state.isPlaying ? "Pause" : "Play"}
              className="rounded p-1 transition-colors hover:bg-white/15"
            >
              {state.isPlaying ? (
                <Pause className="h-5 w-5 fill-white" />
              ) : (
                <Play className="h-5 w-5 fill-white" />
              )}
            </button>
            <VolumeControl
              volume={state.volume}
              muted={state.muted}
              onVolume={setVolume}
              onToggleMute={toggleMute}
            />
            {state.seekable ? (
              <ElapsedTime
                currentTime={transportTime}
                duration={transportDuration}
              />
            ) : (
              <TransportLive
                atLiveEdge={state.atLiveEdge}
                secondsBehindLive={state.secondsBehindLive}
                onJumpToLive={jumpToLive}
              />
            )}
          </>
        }
        right={
          <>
            <SettingsMenu
              showSpeed={source.kind === "mp4"}
              playbackRate={state.playbackRate}
              onPlaybackRate={handlePlaybackRateChange}
              levels={media.levels}
              activeLevel={media.activeLevel}
              onLevel={media.setLevel}
            />
            {showChatToggle && (
              <button
                type="button"
                onClick={layout!.toggleChatOverlay}
                aria-label={
                  layout!.chatOverlayVisible ? "Hide chat" : "Show chat"
                }
                className="rounded p-1 text-white transition-colors hover:bg-white/15"
              >
                {layout!.chatOverlayVisible ? (
                  <MessageSquare className="h-5 w-5" />
                ) : (
                  <MessageSquareOff className="h-5 w-5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className="rounded p-1 text-white transition-colors hover:bg-white/15"
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </button>
          </>
        }
      />
    </div>
  );
}
