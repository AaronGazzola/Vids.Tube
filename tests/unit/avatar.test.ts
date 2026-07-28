import { describe, expect, it } from "vitest";
import { upscaleGgphtAvatar } from "@/lib/youtube";

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
