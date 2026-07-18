"use client";

import {
  CHROME_ABOVE,
  CHROME_BELOW,
  MOBILE_CHROME_REF_WIDTH,
  MobileChromeOverlay,
  MobileChromeTopBar,
} from "@/components/mobile-chrome";
import Hls from "hls.js";
import { VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function LivePlayer({
  src,
  mobileChrome,
  onPortraitChange,
}: {
  src: string;
  mobileChrome?: { handle: string | null; avatarUrl: string | null } | null;
  onPortraitChange?: (portrait: boolean | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [portrait, setPortrait] = useState<boolean | null>(null);
  const [videoWidth, setVideoWidth] = useState(0);
  const portraitCallbackRef = useRef(onPortraitChange);

  useEffect(() => {
    portraitCallbackRef.current = onPortraitChange;
  }, [onPortraitChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = true;
    const syncMuted = () => setMuted(video.muted);
    video.addEventListener("volumechange", syncMuted);

    setPortrait(null);
    portraitCallbackRef.current?.(null);
    const syncPortrait = () => {
      if (!video.videoWidth || !video.videoHeight) {
        return;
      }
      const isPortrait = video.videoHeight > video.videoWidth;
      setPortrait(isPortrait);
      portraitCallbackRef.current?.(isPortrait);
    };
    video.addEventListener("loadedmetadata", syncPortrait);

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        setVideoWidth(rect.width);
      }
    });
    observer.observe(video);

    let hls: Hls | undefined;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: true,
        liveDurationInfinity: true,
        backBufferLength: 30,
        maxLiveSyncPlaybackRate: 1.5,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) {
          return;
        }
        console.error("HLS fatal error", data.type, data.details);
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls!.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls!.recoverMediaError();
        } else {
          hls!.destroy();
        }
      });
    } else {
      console.error("HLS is not supported in this browser");
    }

    video.play().catch(() => {});

    return () => {
      video.removeEventListener("volumechange", syncMuted);
      video.removeEventListener("loadedmetadata", syncPortrait);
      observer.disconnect();
      hls?.destroy();
    };
  }, [src]);

  const unmute = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.muted = false;
    video.volume = 1;
    video.play().catch(() => {});
  };

  const chromeActive = !!mobileChrome && portrait === true && videoWidth > 0;
  const scale = videoWidth / MOBILE_CHROME_REF_WIDTH;

  return (
    <div
      className="relative flex w-full justify-center overflow-hidden rounded-lg bg-black"
      style={
        chromeActive
          ? {
              paddingTop: CHROME_ABOVE * scale,
              paddingBottom: CHROME_BELOW * scale,
            }
          : undefined
      }
    >
      <div className="relative flex max-w-full justify-center">
        <video
          ref={videoRef}
          controls
          playsInline
          className="max-h-[80vh] w-auto max-w-full"
        />
        {chromeActive && (
          <>
            <div className="absolute bottom-full left-0 right-0">
              <MobileChromeTopBar
                scale={scale}
                handle={mobileChrome!.handle}
                avatarUrl={mobileChrome!.avatarUrl}
              />
            </div>
            <MobileChromeOverlay scale={scale} />
          </>
        )}
      </div>
      {muted && (
        <button
          type="button"
          onClick={unmute}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:bg-black"
        >
          <VolumeX className="h-4 w-4" />
          Tap to unmute
        </button>
      )}
    </div>
  );
}
