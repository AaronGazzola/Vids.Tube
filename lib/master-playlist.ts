/**
 * NOT VIABLE AS WRITTEN — see TEMP-2026-08-10-quality-ladder-handover.md.
 *
 * buildMasterPlaylist assumes each MediaMTX path serves a plain media playlist
 * at index.m3u8. It does not: index.m3u8 is itself a multivariant playlist, and
 * it mints a per-viewer session token on every request. A master cannot point at
 * another master, and a static file cannot carry a per-viewer token.
 *
 * variantPlaylistUrl is correct and is what the live route uses today.
 */
import {
  ALL_RENDITIONS,
  SOURCE_RENDITION,
  type Rendition,
} from "./renditions";

export const MASTER_PLAYLIST_NAME = "master.m3u8";
export const VARIANT_PLAYLIST_NAME = "index.m3u8";

function variantUri(channelPath: string, rendition: Rendition): string {
  if (rendition.suffix === "") {
    return VARIANT_PLAYLIST_NAME;
  }
  return `../${channelPath}${rendition.suffix}/${VARIANT_PLAYLIST_NAME}`;
}

export function buildMasterPlaylist(
  channelPath: string,
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
    lines.push(variantUri(channelPath, rendition));
  }

  return `${lines.join("\n")}\n`;
}

export function masterPlaylistUrl(host: string, channelPath: string): string {
  return `${host}/${channelPath}/${MASTER_PLAYLIST_NAME}`;
}

export function variantPlaylistUrl(host: string, channelPath: string): string {
  return `${host}/${channelPath}/${VARIANT_PLAYLIST_NAME}`;
}

export { SOURCE_RENDITION };
