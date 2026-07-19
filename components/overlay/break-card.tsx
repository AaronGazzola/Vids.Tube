"use client";

import { useEffect, useState } from "react";

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function BreakCard({
  endsAt,
  onDone,
}: {
  endsAt: string | number;
  onDone?: () => void;
}) {
  const endMs = typeof endsAt === "number" ? endsAt : new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = endMs - now;
  const done = remaining <= 0;

  useEffect(() => {
    if (done && onDone) onDone();
  }, [done, onDone]);

  if (done) return null;

  return (
    <div className="flex w-[320px] flex-col items-center gap-1 rounded-2xl border border-white/15 bg-black/70 px-8 py-6 text-white shadow-lg backdrop-blur-sm">
      <span className="text-2xl font-semibold tracking-wide">Back soon</span>
      <span className="text-5xl font-bold tabular-nums">
        {formatRemaining(remaining)}
      </span>
    </div>
  );
}
