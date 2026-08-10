export type Rendition = {
  name: string;
  suffix: string;
  width: number;
  height: number;
  videoKbps: number;
  advertisedBandwidth: number;
  codecs: string;
};

export const SOURCE_KEYFRAME_INTERVAL_S = 1;

export const SOURCE_RENDITION: Rendition = {
  name: "source",
  suffix: "",
  width: 1080,
  height: 1920,
  videoKbps: 5000,
  advertisedBandwidth: 5_400_000,
  codecs: "avc1.640028,mp4a.40.2",
};

export const LADDER_RENDITIONS: Rendition[] = [
  {
    name: "540p",
    suffix: "_540",
    width: 540,
    height: 960,
    videoKbps: 1200,
    advertisedBandwidth: 1_400_000,
    codecs: "avc1.64001e,mp4a.40.2",
  },
  {
    name: "720p",
    suffix: "_720",
    width: 720,
    height: 1280,
    videoKbps: 2500,
    advertisedBandwidth: 2_700_000,
    codecs: "avc1.64001f,mp4a.40.2",
  },
];

export const ALL_RENDITIONS: Rendition[] = [
  ...LADDER_RENDITIONS,
  SOURCE_RENDITION,
];

export function renditionPath(channelPath: string, suffix: string): string {
  return `${channelPath}${suffix}`;
}

export function parseRenditionPath(
  path: string
): { channelPath: string; rendition: Rendition } | null {
  for (const rendition of LADDER_RENDITIONS) {
    if (path.length > rendition.suffix.length && path.endsWith(rendition.suffix)) {
      return {
        channelPath: path.slice(0, -rendition.suffix.length),
        rendition,
      };
    }
  }
  return null;
}

export function isRenditionPath(path: string): boolean {
  return parseRenditionPath(path) !== null;
}
