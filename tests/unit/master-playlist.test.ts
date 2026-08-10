import { describe, expect, it } from "vitest";
import {
  buildMasterPlaylist,
  masterPlaylistUrl,
  playbackAddress,
  variantPlaylistUrl,
} from "@/lib/master-playlist";
import { ALL_RENDITIONS, SOURCE_RENDITION, variantPlaylistName } from "@/lib/renditions";

function variantLines(playlist: string): { attrs: string; uri: string }[] {
  const lines = playlist.trim().split("\n");
  const out: { attrs: string; uri: string }[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith("#EXT-X-STREAM-INF:")) {
      out.push({ attrs: lines[i], uri: lines[i + 1] });
    }
  }
  return out;
}

const NAMES_THE_TRANSCODER_WRITES = [
  "stream_540.m3u8",
  "stream_720.m3u8",
  "stream_1080.m3u8",
];

describe("master playlist", () => {
  it("advertises every rendition once", () => {
    expect(variantLines(buildMasterPlaylist())).toHaveLength(
      ALL_RENDITIONS.length
    );
  });

  it("orders renditions lowest bandwidth first", () => {
    const bandwidths = variantLines(buildMasterPlaylist()).map((v) =>
      Number(v.attrs.match(/BANDWIDTH=(\d+)/)![1])
    );
    expect(bandwidths).toEqual([...bandwidths].sort((a, b) => a - b));
    expect(bandwidths[0]).toBe(
      Math.min(...ALL_RENDITIONS.map((r) => r.advertisedBandwidth))
    );
  });

  it("addresses each rendition as a sibling file the transcoder writes", () => {
    const base = new URL("https://stream.vids.tube/ladder/owner/master.m3u8");
    const resolved = variantLines(buildMasterPlaylist()).map(
      (v) => new URL(v.uri, base).pathname
    );

    for (const name of NAMES_THE_TRANSCODER_WRITES) {
      expect(resolved).toContain(`/ladder/owner/${name}`);
    }
  });

  it("carries no session token and no absolute address", () => {
    for (const variant of variantLines(buildMasterPlaylist())) {
      expect(variant.uri).not.toContain("?");
      expect(variant.uri).not.toContain("/");
    }
  });

  it("names every rendition the way the transcoder names it", () => {
    expect(ALL_RENDITIONS.map(variantPlaylistName).sort()).toEqual(
      [...NAMES_THE_TRANSCODER_WRITES].sort()
    );
  });

  it("advertises a bandwidth above each rendition's configured video rate", () => {
    for (const rendition of ALL_RENDITIONS) {
      expect(rendition.advertisedBandwidth).toBeGreaterThan(
        rendition.videoKbps * 1000
      );
    }
  });

  it("declares resolution and codecs for every rendition", () => {
    const playlist = buildMasterPlaylist();
    for (const rendition of ALL_RENDITIONS) {
      expect(playlist).toContain(
        `RESOLUTION=${rendition.width}x${rendition.height}`
      );
      expect(playlist).toContain(`CODECS="${rendition.codecs}"`);
    }
  });

  it("starts with the required manifest headers", () => {
    const playlist = buildMasterPlaylist();
    expect(playlist.startsWith("#EXTM3U\n")).toBe(true);
    expect(playlist).toContain("#EXT-X-INDEPENDENT-SEGMENTS");
  });

  it("advertises the source rendition at the top of the ladder", () => {
    const variants = variantLines(buildMasterPlaylist());
    const last = variants[variants.length - 1];
    expect(last.attrs).toContain(
      `BANDWIDTH=${SOURCE_RENDITION.advertisedBandwidth}`
    );
    expect(last.uri).toBe(variantPlaylistName(SOURCE_RENDITION));
  });

  it("builds the address a going-live broadcast records with a ladder", () => {
    expect(masterPlaylistUrl("https://stream.vids.tube", "owner")).toBe(
      "https://stream.vids.tube/ladder/owner/master.m3u8"
    );
  });

  it("leaves the single-rendition address earlier broadcasts hold unchanged", () => {
    expect(variantPlaylistUrl("https://stream.vids.tube", "owner")).toBe(
      "https://stream.vids.tube/owner/index.m3u8"
    );
  });
});

describe("the address a going-live broadcast records", () => {
  const host = "https://stream.vids.tube";

  it("is the master playlist when the machine reports a ladder", () => {
    expect(playbackAddress(host, "owner", "1")).toBe(
      "https://stream.vids.tube/ladder/owner/master.m3u8"
    );
  });

  it("is the single-rendition address when the machine reports nothing", () => {
    expect(playbackAddress(host, "owner", null)).toBe(
      "https://stream.vids.tube/owner/index.m3u8"
    );
  });

  it("is the single-rendition address for anything other than an explicit yes", () => {
    for (const reported of ["", "0", "yes", "true"]) {
      expect(playbackAddress(host, "owner", reported)).toBe(
        "https://stream.vids.tube/owner/index.m3u8"
      );
    }
  });

  it("uses the channel it is given rather than a hardcoded one", () => {
    expect(playbackAddress(host, "someone-else", "1")).toBe(
      "https://stream.vids.tube/ladder/someone-else/master.m3u8"
    );
  });
});
