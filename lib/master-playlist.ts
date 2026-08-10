import {
  ALL_RENDITIONS,
  SOURCE_RENDITION,
  variantPlaylistName,
  type Rendition,
} from "./renditions";

export const MASTER_PLAYLIST_NAME = "master.m3u8";
export const SINGLE_RENDITION_PLAYLIST_NAME = "index.m3u8";
export const LADDER_URL_PREFIX = "ladder";

export function buildMasterPlaylist(
  renditions: Rendition[] = ALL_RENDITIONS
): string {
  const ordered = [...renditions].sort(
    (a, b) => a.advertisedBandwidth - b.advertisedBandwidth
  );

  const lines = ["#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-INDEPENDENT-SEGMENTS"];

  for (const rendition of ordered) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.advertisedBandwidth},RESOLUTION=${rendition.width}x${rendition.height},CODECS="${rendition.codecs}"`
    );
    lines.push(variantPlaylistName(rendition));
  }

  return `${lines.join("\n")}\n`;
}

export function masterPlaylistUrl(host: string, channelPath: string): string {
  return `${host}/${LADDER_URL_PREFIX}/${channelPath}/${MASTER_PLAYLIST_NAME}`;
}

export function variantPlaylistUrl(host: string, channelPath: string): string {
  return `${host}/${channelPath}/${SINGLE_RENDITION_PLAYLIST_NAME}`;
}

export function playbackAddress(
  host: string,
  channelPath: string,
  ladderReported: string | null
): string {
  return ladderReported === "1"
    ? masterPlaylistUrl(host, channelPath)
    : variantPlaylistUrl(host, channelPath);
}

export { SOURCE_RENDITION };
