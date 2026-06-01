"use client";

import { cn } from "@/lib/utils";
import type { Database } from "@/supabase/types";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type Video = Database["public"]["Tables"]["videos"]["Row"];

const VOD_BASE_URL = process.env.NEXT_PUBLIC_VOD_BASE_URL ?? "";

const HOVER_DEBOUNCE_MS = 120;
const PREVIEW_INTERVAL_MS = 700;

function formatDate(value: string | null): string {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) {
    return null;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";

function subscribeHover(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const query = window.matchMedia(HOVER_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getHoverSnapshot(): boolean {
  return window.matchMedia(HOVER_QUERY).matches;
}

function getHoverServerSnapshot(): boolean {
  return false;
}

function useHoverCapable(): boolean {
  return useSyncExternalStore(
    subscribeHover,
    getHoverSnapshot,
    getHoverServerSnapshot
  );
}

export function VideoCard({ video }: { video: Video }) {
  const duration = formatDuration(video.duration_s);
  const hoverCapable = useHoverCapable();
  const previews = video.preview_paths ?? [];
  const hasPreviews = previews.length > 0;

  const debounceRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const stop = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setHoverIndex(null);
  }, []);

  useEffect(() => stop, [stop]);

  const handleMouseEnter = () => {
    if (!hoverCapable || !hasPreviews) {
      return;
    }
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      setHoverIndex(0);
      intervalRef.current = window.setInterval(() => {
        setHoverIndex((prev) => {
          const next = (prev ?? -1) + 1;
          return next >= previews.length ? 0 : next;
        });
      }, PREVIEW_INTERVAL_MS);
    }, HOVER_DEBOUNCE_MS);
  };

  const handleMouseLeave = () => {
    stop();
  };

  const showingPreview = hoverIndex !== null && hasPreviews;
  const previewSrc = showingPreview
    ? `${VOD_BASE_URL}/${previews[hoverIndex]}`
    : null;
  const posterSrc = video.thumbnail_path
    ? `${VOD_BASE_URL}/${video.thumbnail_path}`
    : null;

  return (
    <Link
      href={`/watch/${video.id}`}
      className="group flex flex-col gap-3"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
        {posterSrc && (
          <img
            src={posterSrc}
            alt={video.title ?? "Video thumbnail"}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-transform duration-300",
              !showingPreview && "group-hover:scale-105"
            )}
          />
        )}
        {previewSrc && (
          <img
            key={previewSrc}
            src={previewSrc}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {duration}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="line-clamp-2 font-medium leading-snug">
          {video.title ?? "Untitled"}
        </span>
        {video.published_at && (
          <span className="text-xs text-muted-foreground">
            {formatDate(video.published_at)}
          </span>
        )}
      </div>
    </Link>
  );
}
