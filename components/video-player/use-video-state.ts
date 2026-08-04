"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export const LIVE_EDGE_TOLERANCE_S = 5;

export type VideoState = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  isReady: boolean;
  buffering: boolean;
  error: string | null;
  seekable: boolean;
  atLiveEdge: boolean | undefined;
  secondsBehindLive: number | undefined;
};

// Seeded from the source rather than fixed, so a live surface never paints a
// seek bar for the frame before the first sync.
function initialState(live: boolean): VideoState {
  return {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: live,
    playbackRate: 1,
    isFullscreen: false,
    isReady: false,
    buffering: false,
    error: null,
    seekable: !live,
    atLiveEdge: undefined,
    secondsBehindLive: undefined,
  };
}

function bufferedAhead(video: HTMLVideoElement): number {
  const ranges = video.buffered;
  const t = video.currentTime;
  for (let i = 0; i < ranges.length; i++) {
    const start = ranges.start(i);
    const end = ranges.end(i);
    if (t >= start && t <= end) {
      return end;
    }
  }
  return t;
}

// Safari plays HLS itself and reports no live sync position, so the end of the
// seekable range stands in for the edge.
function seekableEnd(video: HTMLVideoElement): number | null {
  const ranges = video.seekable;
  if (ranges.length === 0) {
    return null;
  }
  const end = ranges.end(ranges.length - 1);
  return Number.isFinite(end) ? end : null;
}

function errorMessage(video: HTMLVideoElement): string | null {
  const error = video.error;
  if (!error) {
    return null;
  }
  if (error.code === error.MEDIA_ERR_NETWORK) {
    return "The connection dropped while loading this video.";
  }
  if (error.code === error.MEDIA_ERR_DECODE) {
    return "This video could not be decoded.";
  }
  if (error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "This video format is not supported here.";
  }
  return "This video could not be played.";
}

export function useVideoState(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef: RefObject<HTMLElement | null>,
  options: {
    live?: boolean;
    liveSyncRef?: RefObject<number | null>;
  } = {}
): VideoState {
  const { live = false, liveSyncRef } = options;
  const [state, setState] = useState<VideoState>(() => initialState(live));
  const bufferingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const sync = () => {
      const edge = live
        ? liveSyncRef?.current ?? seekableEnd(video) ?? null
        : null;
      const behind = edge === null ? undefined : Math.max(0, edge - video.currentTime);
      setState({
        isPlaying: !video.paused && !video.ended,
        currentTime: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        buffered: bufferedAhead(video),
        volume: video.volume,
        muted: video.muted,
        playbackRate: video.playbackRate,
        isFullscreen: document.fullscreenElement === containerRef.current,
        isReady: video.readyState >= 1,
        buffering: bufferingRef.current,
        error: errorMessage(video),
        seekable: !live,
        atLiveEdge: live
          ? behind !== undefined && behind <= LIVE_EDGE_TOLERANCE_S
          : undefined,
        secondsBehindLive: live ? behind : undefined,
      });
    };

    sync();

    const startBuffering = () => {
      bufferingRef.current = true;
      sync();
    };
    const stopBuffering = () => {
      bufferingRef.current = false;
      sync();
    };

    const events: (keyof HTMLMediaElementEventMap)[] = [
      "play",
      "pause",
      "ended",
      "timeupdate",
      "durationchange",
      "loadedmetadata",
      "progress",
      "volumechange",
      "ratechange",
      "seeking",
      "seeked",
      "error",
    ];
    for (const event of events) {
      video.addEventListener(event, sync);
    }
    video.addEventListener("waiting", startBuffering);
    video.addEventListener("stalled", startBuffering);
    video.addEventListener("playing", stopBuffering);
    video.addEventListener("canplay", stopBuffering);
    document.addEventListener("fullscreenchange", sync);

    return () => {
      for (const event of events) {
        video.removeEventListener(event, sync);
      }
      video.removeEventListener("waiting", startBuffering);
      video.removeEventListener("stalled", startBuffering);
      video.removeEventListener("playing", stopBuffering);
      video.removeEventListener("canplay", stopBuffering);
      document.removeEventListener("fullscreenchange", sync);
    };
  }, [videoRef, containerRef, live, liveSyncRef]);

  return state;
}
