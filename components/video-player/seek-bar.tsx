"use client";

import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type SeekBarProps = {
  currentTime: number;
  duration: number;
  buffered: number;
  onSeek: (time: number) => void;
};

export function SeekBar({
  currentTime,
  duration,
  buffered,
  onSeek,
}: SeekBarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const displayTime = dragValue ?? currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const timeForEvent = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration <= 0) {
        return 0;
      }
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width)
      );
      return ratio * duration;
    },
    [duration]
  );

  useEffect(() => {
    if (!draggingRef.current) {
      return;
    }
    function onMove(e: PointerEvent) {
      setDragValue(timeForEvent(e.clientX));
    }
    function onUp(e: PointerEvent) {
      const final = timeForEvent(e.clientX);
      draggingRef.current = false;
      setDragValue(null);
      onSeek(final);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  });

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (duration <= 0) {
      return;
    }
    draggingRef.current = true;
    const t = timeForEvent(e.clientX);
    setDragValue(t);
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.max(1, Math.round(duration))}
      aria-valuenow={Math.round(displayTime)}
      tabIndex={-1}
      className="group/seek relative h-1.5 w-full cursor-pointer rounded-full bg-white/25"
      onPointerDown={handlePointerDown}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-white/40"
        style={{ width: `${bufferedPct}%` }}
      />
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-primary"
        style={{ width: `${progress}%` }}
      />
      <div
        className={cn(
          "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity",
          "group-hover/seek:opacity-100",
          dragValue !== null && "opacity-100"
        )}
        style={{ left: `${progress}%` }}
      />
    </div>
  );
}
