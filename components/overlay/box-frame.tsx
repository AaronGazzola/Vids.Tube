"use client";

export function OverlayBoxFrame({
  scale,
  width,
  children,
}: {
  scale: number;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {children}
    </div>
  );
}
