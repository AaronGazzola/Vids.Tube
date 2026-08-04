import type { RefObject } from "react";

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
};

export function isLiveSource(source: PlayerSource): boolean {
  return source.kind === "hls" && source.live;
}
