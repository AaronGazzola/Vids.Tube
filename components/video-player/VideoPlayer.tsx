"use client";

import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Controls } from "./controls";
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "./speed-menu";
import { useVideoState } from "./use-video-state";

export type VideoPlayerProps = {
  src: string;
  poster?: string;
  width?: number | null;
  height?: number | null;
  className?: string;
};

const SEEK_STEP_SECONDS = 5;
const CONTROLS_AUTOHIDE_MS = 2500;

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
  src,
  poster,
  width,
  height,
  className,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  const state = useVideoState(videoRef, containerRef);

  const vertical = isVertical(width, height);

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

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      seek(video.currentTime + deltaSeconds);
    },
    [seek]
  );

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

  const setPlaybackRate = useCallback((rate: PlaybackSpeed) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.playbackRate = rate;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    if (document.fullscreenElement === container) {
      void document.exitFullscreen().catch((error) => {
        console.error(error);
      });
    } else {
      void container.requestFullscreen().catch((error) => {
        console.error(error);
      });
    }
  }, []);

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
          e.preventDefault();
          seekBy(-SEEK_STEP_SECONDS);
          showControls();
          break;
        case "ArrowRight":
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
    [seekBy, showControls, togglePlay, toggleFullscreen, toggleMute]
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
      className={cn(
        "group/player relative isolate mx-auto w-full overflow-hidden rounded-lg bg-black outline-none focus-visible:ring-2 focus-visible:ring-primary",
        vertical
          ? "aspect-[9/16] max-w-[min(420px,calc(80vh*9/16))]"
          : "aspect-video",
        className
      )}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        onClick={handleVideoClick}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handlePause}
        className={cn(
          "h-full w-full bg-black",
          vertical ? "object-contain" : "object-cover"
        )}
      />
      <Controls
        state={state}
        visible={controlsVisible}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onVolume={setVolume}
        onToggleMute={toggleMute}
        onPlaybackRate={handlePlaybackRateChange}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  );
}
