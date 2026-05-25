"use client";

import Hls from "hls.js";
import { VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function LivePlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = true;
    const syncMuted = () => setMuted(video.muted);
    video.addEventListener("volumechange", syncMuted);

    let hls: Hls | undefined;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: true,
        liveDurationInfinity: true,
        backBufferLength: 30,
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

  return (
    <div className="relative flex w-full justify-center overflow-hidden rounded-lg bg-black">
      <video
        ref={videoRef}
        controls
        playsInline
        className="max-h-[80vh] w-auto max-w-full"
      />
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
