"use client";

import Hls from "hls.js";
import { useEffect, useRef } from "react";

export function LivePlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (!Hls.isSupported()) {
      console.error("HLS is not supported in this browser");
      return;
    }

    const hls = new Hls({ liveDurationInfinity: true });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) {
        return;
      }
      console.error("HLS fatal error", data.type, data.details);
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad();
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
      } else {
        hls.destroy();
      }
    });

    return () => {
      hls.destroy();
    };
  }, [src]);

  return (
    <div className="flex w-full justify-center overflow-hidden rounded-lg bg-black">
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        className="max-h-[80vh] w-auto max-w-full"
      />
    </div>
  );
}
