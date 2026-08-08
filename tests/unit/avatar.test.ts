import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheChannelAvatar } from "@/lib/channel-avatar";
import { upscaleGgphtAvatar } from "@/lib/youtube";

vi.mock("@/lib/r2", () => ({ uploadToR2: vi.fn(async () => {}) }));

describe("upscaleGgphtAvatar", () => {
  it("rewrites a low-res size token to s800 for ggpht URLs", () => {
    expect(
      upscaleGgphtAvatar("https://yt3.ggpht.com/abc123=s64-c-k-c0x00ffffff-no-rj")
    ).toBe("https://yt3.ggpht.com/abc123=s800-c-k-c0x00ffffff-no-rj");
  });

  it("rewrites any numeric size token to s800", () => {
    expect(upscaleGgphtAvatar("https://yt3.ggpht.com/abc=s240-c")).toBe(
      "https://yt3.ggpht.com/abc=s800-c"
    );
  });

  it("leaves non-ggpht URLs unchanged", () => {
    const url = "https://example.com/avatar=s64-c.jpg";
    expect(upscaleGgphtAvatar(url)).toBe(url);
  });
});

describe("cacheChannelAvatar", () => {
  const OLD = "https://yt3.ggpht.com/AAA=s88-c-k-c0x00ffffff-no-rj";
  const CHANGED = "https://yt3.ggpht.com/BBB=s88-c-k-c0x00ffffff-no-rj";
  const fetched: string[] = [];

  beforeEach(() => {
    fetched.length = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      fetched.push(url);
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
    });
  });

  it("downloads the full-size avatar, not the low-res one chat delivers", async () => {
    await cacheChannelAvatar("UC123", OLD);
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toContain("=s800-c");
    expect(fetched[0]).not.toContain("=s88-c");
  });

  it("puts a changed avatar on a new key, so the immutable cache is bypassed", async () => {
    const first = await cacheChannelAvatar("UC123", OLD);
    const unchanged = await cacheChannelAvatar("UC123", OLD);
    const changed = await cacheChannelAvatar("UC123", CHANGED);

    expect(first?.path).toBe(unchanged?.path);
    expect(changed?.path).not.toBe(first?.path);
    expect(changed?.path).toMatch(/^avatars\/UC123-[0-9a-f]{8}\.jpg$/);
  });

  it("records a source URL that a later chat message compares equal to", async () => {
    const stored = await cacheChannelAvatar("UC123", OLD);
    const fromChat = await cacheChannelAvatar("UC123", upscaleGgphtAvatar(OLD));
    expect(fromChat?.sourceUrl).toBe(stored?.sourceUrl);
    expect(fromChat?.path).toBe(stored?.path);
  });

  it("reports no cached avatar when the download fails", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false }));
    expect(await cacheChannelAvatar("UC123", OLD)).toBeNull();
  });
});
