"use client";

import { createContext, useContext, type ReactNode } from "react";

// Overlay content is sized by fixed props and then scaled by a CSS transform on
// its box, so a component cannot tell how large it actually renders. This
// carries the box's scale down to anything that needs real pixels — bitmaps,
// which go soft when upscaled — while text and vector chrome stay crisp on
// their own and can ignore it.
const OverlayScaleContext = createContext(1);

export function OverlayScaleProvider({
  scale,
  children,
}: {
  scale: number;
  children: ReactNode;
}) {
  return (
    <OverlayScaleContext.Provider value={scale}>
      {children}
    </OverlayScaleContext.Provider>
  );
}

export function useOverlayScale(): number {
  return useContext(OverlayScaleContext);
}
