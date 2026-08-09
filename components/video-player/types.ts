import type { RefObject } from "react";

// Type-only, so nothing of hls.js is pulled into a bundle by this import.
import type Hls from "hls.js";

export type PlayerSource =
  | { kind: "mp4"; src: string; poster?: string }
  | { kind: "hls"; src: string; live: boolean };

export type MediaLevel = {
  index: number;
  height: number;
  bitrate: number;
};

export type MediaSourceState = {
  levels: MediaLevel[];
  activeLevel: number;
  setLevel: (index: number) => void;
  latency: number | undefined;
  liveSyncPosition: number | undefined;
  liveSyncRef: RefObject<number | null>;
  hlsRef: RefObject<Hls | null>;
  lastErrorRef: RefObject<string | null>;
};

export function isLiveSource(source: PlayerSource): boolean {
  return source.kind === "hls" && source.live;
}
