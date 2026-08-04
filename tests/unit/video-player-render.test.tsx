// @vitest-environment happy-dom
import { VideoPlayer } from "@/components/video-player";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const MP4 = { kind: "mp4", src: "https://cdn.example/v.mp4" } as const;
const LIVE = { kind: "hls", src: "https://edge.example/s.m3u8", live: true } as const;

function markup(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

describe("what the player paints for each source", () => {
  it("gives an mp4 source a seek bar", () => {
    const html = markup(<VideoPlayer source={MP4} />);
    expect(html).toContain('aria-label="Seek"');
  });

  it("gives a live source no seek bar", () => {
    const html = markup(<VideoPlayer source={LIVE} />);
    expect(html).not.toContain('aria-label="Seek"');
  });

  it("gives a live source the live indicator instead of an elapsed time", () => {
    const html = markup(<VideoPlayer source={LIVE} />);
    expect(html).toContain("Live");
    expect(html).not.toContain("0:00");
  });

  it("leaves the browser's own chrome off both surfaces", () => {
    expect(markup(<VideoPlayer source={MP4} />)).not.toContain("controls=");
    expect(markup(<VideoPlayer source={LIVE} />)).not.toContain("controls=");
  });

  it("starts a live source muted so autoplay is allowed", () => {
    expect(markup(<VideoPlayer source={LIVE} />)).toContain("Tap to unmute");
    expect(markup(<VideoPlayer source={MP4} />)).not.toContain("Tap to unmute");
  });
});

describe("how the frame is sized", () => {
  it("never crops: the video is contained, not covered", () => {
    const html = markup(<VideoPlayer source={MP4} width={1440} height={1080} />);
    expect(html).toContain("object-contain");
    expect(html).not.toContain("object-cover");
  });

  it("takes a 4:3 landscape video's own ratio rather than forcing 16:9", () => {
    const html = markup(<VideoPlayer source={MP4} width={1440} height={1080} />);
    expect(html).toContain(`aspect-ratio:${4 / 3}`);
    expect(html).not.toContain("aspect-video");
  });

  it("takes an ultrawide video's own ratio too", () => {
    const html = markup(<VideoPlayer source={MP4} width={2560} height={1080} />);
    expect(html).toContain(`aspect-ratio:${2560 / 1080}`);
  });

  it("falls back to 16:9 before any dimensions are known", () => {
    const html = markup(<VideoPlayer source={MP4} />);
    expect(html).toContain(`aspect-ratio:${16 / 9}`);
  });

  it("keeps a portrait video bounded to the viewport height", () => {
    const html = markup(<VideoPlayer source={MP4} width={1080} height={1920} />);
    expect(html).toContain("max-w-[min(420px,calc(80vh*9/16))]");
  });
});
