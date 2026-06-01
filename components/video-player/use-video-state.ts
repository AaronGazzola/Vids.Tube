"use client";

import { useEffect, useState, type RefObject } from "react";

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
};

const INITIAL_STATE: VideoState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  volume: 1,
  muted: false,
  playbackRate: 1,
  isFullscreen: false,
  isReady: false,
};

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

export function useVideoState(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef: RefObject<HTMLElement | null>
): VideoState {
  const [state, setState] = useState<VideoState>(INITIAL_STATE);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const sync = () => {
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
      });
    };

    sync();

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
    ];
    for (const event of events) {
      video.addEventListener(event, sync);
    }
    document.addEventListener("fullscreenchange", sync);

    return () => {
      for (const event of events) {
        video.removeEventListener(event, sync);
      }
      document.removeEventListener("fullscreenchange", sync);
    };
  }, [videoRef, containerRef]);

  return state;
}
