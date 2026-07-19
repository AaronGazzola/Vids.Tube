"use client";

export function OverlayEmptyState({
  label,
  width,
  height,
}: {
  label: string;
  width: number;
  height: number;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border-2 border-dashed border-white/40 text-lg font-medium text-white/50"
      style={{ width, height }}
    >
      {label}
    </div>
  );
}
