"use client";

import { SeekBar } from "./seek-bar";

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? m.toString().padStart(2, "0") : m.toString();
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function TransportVod({
  currentTime,
  duration,
  buffered,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  buffered: number;
  onSeek: (time: number) => void;
}) {
  return (
    <SeekBar
      currentTime={currentTime}
      duration={duration}
      buffered={buffered}
      onSeek={onSeek}
    />
  );
}

export function ElapsedTime({
  currentTime,
  duration,
}: {
  currentTime: number;
  duration: number;
}) {
  return (
    <span className="ml-1 select-none text-xs tabular-nums text-white/90">
      {formatTime(currentTime)}{" "}
      <span className="text-white/60">/ {formatTime(duration)}</span>
    </span>
  );
}
