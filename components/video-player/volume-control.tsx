"use client";

import { Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type VolumeControlProps = {
  volume: number;
  muted: boolean;
  onVolume: (value: number) => void;
  onToggleMute: () => void;
};

function VolumeIcon({
  volume,
  muted,
  className,
}: {
  volume: number;
  muted: boolean;
  className?: string;
}) {
  if (muted || volume <= 0) {
    return <VolumeX className={className} />;
  }
  if (volume < 0.33) {
    return <Volume className={className} />;
  }
  if (volume < 0.66) {
    return <Volume1 className={className} />;
  }
  return <Volume2 className={className} />;
}

export function VolumeControl({
  volume,
  muted,
  onVolume,
  onToggleMute,
}: VolumeControlProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const effective = muted ? 0 : volume;
  const display = dragValue ?? effective;

  const valueForEvent = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) {
      return 0;
    }
    const rect = track.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  useEffect(() => {
    if (!draggingRef.current) {
      return;
    }
    function onMove(e: PointerEvent) {
      setDragValue(valueForEvent(e.clientX));
    }
    function onUp(e: PointerEvent) {
      const final = valueForEvent(e.clientX);
      draggingRef.current = false;
      setDragValue(null);
      onVolume(final);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  });

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setDragValue(valueForEvent(e.clientX));
  };

  return (
    <div className="group/vol flex items-center gap-1.5">
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="rounded p-1 text-white transition-colors hover:bg-white/15"
      >
        <VolumeIcon volume={volume} muted={muted} className="h-5 w-5" />
      </button>
      <div
        ref={trackRef}
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(display * 100)}
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        className="relative h-1 w-0 cursor-pointer overflow-hidden rounded-full bg-white/25 transition-[width] group-hover/vol:w-16 group-focus-within/vol:w-16"
      >
        <div
          className="absolute inset-y-0 left-0 bg-white"
          style={{ width: `${display * 100}%` }}
        />
      </div>
    </div>
  );
}
