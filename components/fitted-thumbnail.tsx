"use client";

import { cn, isVertical } from "@/lib/utils";
import type { ReactNode, SyntheticEvent } from "react";
import { useState } from "react";

export function FittedThumbnail({
  src,
  alt,
  width,
  height,
  zoomOnHover = false,
  className,
  children,
}: {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  zoomOnHover?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [portrait, setPortrait] = useState(() => isVertical(width, height));

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setPortrait(img.naturalHeight > img.naturalWidth);
    }
  };

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden bg-muted",
        className
      )}
    >
      {portrait && (
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
        />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        className={cn(
          "absolute inset-0 h-full w-full transition-transform duration-300",
          portrait ? "object-contain" : "object-cover",
          zoomOnHover && !portrait && "group-hover:scale-105"
        )}
      />
      {children}
    </div>
  );
}
