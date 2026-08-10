import { describe, expect, it } from "vitest";
import { buildMasterPlaylist, masterPlaylistUrl } from "@/lib/master-playlist";
import { ALL_RENDITIONS, LADDER_RENDITIONS, SOURCE_RENDITION } from "@/lib/renditions";

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

describe("master playlist", () => {
  it("advertises every rendition once", () => {
    const variants = variantLines(buildMasterPlaylist("owner"));
    expect(variants).toHaveLength(ALL_RENDITIONS.length);
  });

  it("orders renditions lowest bandwidth first", () => {
    const variants = variantLines(buildMasterPlaylist("owner"));
    const bandwidths = variants.map((v) =>
      Number(v.attrs.match(/BANDWIDTH=(\d+)/)![1])
    );
    expect(bandwidths).toEqual([...bandwidths].sort((a, b) => a - b));
    expect(bandwidths[0]).toBe(
      Math.min(...ALL_RENDITIONS.map((r) => r.advertisedBandwidth))
    );
  });

  it("resolves each variant address to the playlist MediaMTX serves", () => {
    const playlist = buildMasterPlaylist("owner");
    const base = new URL("https://stream.vids.tube/owner/master.m3u8");
    const resolved = variantLines(playlist).map((v) =>
      new URL(v.uri, base).pathname
    );

    expect(resolved).toContain("/owner/index.m3u8");
    for (const rendition of LADDER_RENDITIONS) {
      expect(resolved).toContain(`/owner${rendition.suffix}/index.m3u8`);
    }
  });

  it("uses the channel path it is given, not a hardcoded one", () => {
    const playlist = buildMasterPlaylist("someone-else");
    const base = new URL("https://stream.vids.tube/someone-else/master.m3u8");
    const resolved = variantLines(playlist).map((v) =>
      new URL(v.uri, base).pathname
    );
    expect(resolved).toContain("/someone-else_720/index.m3u8");
    expect(resolved.every((p) => !p.startsWith("/owner"))).toBe(true);
  });

  it("advertises a bandwidth above each rendition's configured video rate", () => {
    for (const rendition of ALL_RENDITIONS) {
      expect(rendition.advertisedBandwidth).toBeGreaterThan(
        rendition.videoKbps * 1000
      );
    }
  });

  it("declares resolution and codecs for every rendition", () => {
    const playlist = buildMasterPlaylist("owner");
    for (const rendition of ALL_RENDITIONS) {
      expect(playlist).toContain(
        `RESOLUTION=${rendition.width}x${rendition.height}`
      );
      expect(playlist).toContain(`CODECS="${rendition.codecs}"`);
    }
  });

  it("starts with the required manifest headers", () => {
    const playlist = buildMasterPlaylist("owner");
    expect(playlist.startsWith("#EXTM3U\n")).toBe(true);
    expect(playlist).toContain("#EXT-X-INDEPENDENT-SEGMENTS");
  });

  it("keeps the source rendition addressed relative to itself", () => {
    const variants = variantLines(buildMasterPlaylist("owner"));
    const source = variants.find((v) =>
      v.attrs.includes(`BANDWIDTH=${SOURCE_RENDITION.advertisedBandwidth}`)
    );
    expect(source?.uri).toBe("index.m3u8");
  });

  it("builds the address a going-live broadcast records", () => {
    expect(masterPlaylistUrl("https://stream.vids.tube", "owner")).toBe(
      "https://stream.vids.tube/owner/master.m3u8"
    );
  });
});
