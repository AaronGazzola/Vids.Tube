"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ControlsProps = {
  visible: boolean;
  transport: ReactNode;
  left: ReactNode;
  right: ReactNode;
};

// The shell owns the gradient, the autohide and the two-row arrangement. What
// fills the transport row and the two control clusters is decided by the
// surface, so live and VOD share one chrome instead of forking it.
export function Controls({ visible, transport, left, right }: ControlsProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/15 to-transparent transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0"
      )}
      aria-hidden={!visible}
    >
      <div
        className={cn(
          "flex flex-col gap-1.5 px-3 pb-2 pt-6",
          visible ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {transport}
        <div className="flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-1.5">{left}</div>
          <div className="flex items-center gap-1">{right}</div>
        </div>
      </div>
    </div>
  );
}
