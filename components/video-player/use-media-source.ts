"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { MediaLevel, MediaSourceState, PlayerSource } from "./types";

// hls.js is only ever loaded through the dynamic import below, so the watch
// page never pays for a library it cannot use. The type import is erased at
// compile time and pulls nothing into the bundle.
import type Hls from "hls.js";

export function useMediaSource(
  videoRef: RefObject<HTMLVideoElement | null>,
  source: PlayerSource
): MediaSourceState {
  const [levels, setLevels] = useState<MediaLevel[]>([]);
  const [pinnedLevel, setPinnedLevel] = useState(-1);
  const [latency, setLatency] = useState<number | undefined>(undefined);
  const [liveSyncPosition, setLiveSyncPosition] = useState<number | undefined>(
    undefined
  );
  const liveSyncRef = useRef<number | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const { kind, src } = source;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    setLevels([]);
    setPinnedLevel(-1);
    setLatency(undefined);
    setLiveSyncPosition(undefined);
    liveSyncRef.current = null;

    if (kind === "mp4") {
      video.src = src;
      return;
    }

    // Safari plays HLS natively and exposes no level list; the live edge comes
    // from the seekable range instead, read in the state hook.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    let cancelled = false;
    let instance: Hls | null = null;

    const attach = async () => {
      const { default: HlsCtor } = await import("hls.js");
      if (cancelled || !HlsCtor.isSupported()) {
        if (!HlsCtor.isSupported()) {
          console.error("HLS is not supported in this browser");
        }
        return;
      }
      instance = new HlsCtor({
        lowLatencyMode: true,
        liveDurationInfinity: true,
        backBufferLength: 30,
        maxLiveSyncPlaybackRate: 1.5,
      });
      hlsRef.current = instance;
      instance.loadSource(src);
      instance.attachMedia(video);

      instance.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        setLevels(
          instance!.levels.map((level, index) => ({
            index,
            height: level.height,
            bitrate: level.bitrate,
          }))
        );
      });

      const syncLive = () => {
        const position = instance!.liveSyncPosition;
        liveSyncRef.current = Number.isFinite(position ?? NaN)
          ? (position as number)
          : null;
        setLiveSyncPosition(liveSyncRef.current ?? undefined);
        setLatency(instance!.latency);
      };
      instance.on(HlsCtor.Events.FRAG_CHANGED, syncLive);
      instance.on(HlsCtor.Events.LEVEL_UPDATED, syncLive);

      instance.on(HlsCtor.Events.ERROR, (_event, data) => {
        if (!data.fatal) {
          return;
        }
        console.error("HLS fatal error", data.type, data.details);
        if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
          instance!.startLoad();
        } else if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
          instance!.recoverMediaError();
        } else {
          instance!.destroy();
        }
      });
    };

    void attach();

    return () => {
      cancelled = true;
      instance?.destroy();
      if (hlsRef.current === instance) {
        hlsRef.current = null;
      }
    };
  }, [videoRef, kind, src]);

  const setLevel = useCallback((index: number) => {
    setPinnedLevel(index);
    const instance = hlsRef.current;
    if (instance) {
      instance.currentLevel = index;
    }
  }, []);

  return {
    levels,
    activeLevel: pinnedLevel,
    setLevel,
    latency,
    liveSyncPosition,
    liveSyncRef,
  };
}
