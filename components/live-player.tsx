"use client";

import {
  CHROME_ABOVE,
  CHROME_BELOW,
  MOBILE_CHROME_REF_WIDTH,
  MobileChromeOverlay,
  MobileChromeTopBar,
} from "@/components/mobile-chrome";
import { VideoPlayer } from "@/components/video-player";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// The live surface is the shared player with a live HLS source. What is left
// here is only the chrome that is not the player: the phone frame mock and
// whatever overlay the caller wants above the video.
export function LivePlayer({
  src,
  mobileChrome,
  onPortraitChange,
  overlay,
}: {
  src: string;
  mobileChrome?: { handle: string | null; avatarUrl: string | null } | null;
  onPortraitChange?: (portrait: boolean | null) => void;
  overlay?: ReactNode;
}) {
  // Orientation is recorded against the source it was measured from, so a new
  // source reads as unknown again without an effect resetting it.
  const [measured, setMeasured] = useState<{
    src: string;
    portrait: boolean;
  } | null>(null);
  const [videoWidth, setVideoWidth] = useState(0);
  const portrait = measured?.src === src ? measured.portrait : null;

  const portraitCallbackRef = useRef(onPortraitChange);
  useEffect(() => {
    portraitCallbackRef.current = onPortraitChange;
  }, [onPortraitChange]);

  useEffect(() => {
    portraitCallbackRef.current?.(portrait);
  }, [portrait]);

  const handleDimensions = useCallback(
    (width: number, height: number) => {
      setMeasured({ src, portrait: height > width });
    },
    [src]
  );

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
      <VideoPlayer
        source={{ kind: "hls", src, live: true }}
        onDimensions={handleDimensions}
        onResize={setVideoWidth}
        containerClassName={chromeActive ? "overflow-visible" : undefined}
      >
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
        {overlay}
      </VideoPlayer>
    </div>
  );
}
