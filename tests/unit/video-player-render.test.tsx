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

  // hls.js attaches its MediaSource after a dynamic import resolves, so a play()
  // call from an effect runs before there is anything to play and the attach that
  // follows returns the element to paused. Only the attribute survives that order.
  it("asks the element itself to start a live source, not an effect", () => {
    const html = markup(<VideoPlayer source={LIVE} />).toLowerCase();
    expect(html).toContain("autoplay=");
    expect(html).toContain("muted=");
  });

  it("leaves a file source to the viewer", () => {
    const html = markup(<VideoPlayer source={MP4} />).toLowerCase();
    expect(html).not.toContain("autoplay=");
  });
});

describe("the playback health readout", () => {
  it("stays off until asked for", () => {
    expect(markup(<VideoPlayer source={LIVE} />)).not.toContain(
      "Playback health"
    );
  });

  it("reports buffer, headroom and stalls when asked for", () => {
    const html = markup(<VideoPlayer source={LIVE} diagnostics />);
    expect(html).toContain("Playback health");
    expect(html).toContain("Buffer ahead");
    expect(html).toContain("Headroom");
    expect(html).toContain("Stalls");
  });

  // The whole point of the panel: the two candidate causes of a flashing spinner
  // must be distinguishable, so both the download rate and what the stream needs
  // are shown rather than a single verdict the reader cannot check.
  it("shows the download rate against what the stream needs", () => {
    const html = markup(<VideoPlayer source={LIVE} diagnostics />);
    expect(html).toContain("Download");
    expect(html).toContain("Stream needs");
  });
});

describe("the transport's clock", () => {
  const SPANS = [
    { startS: 100, endS: 160 },
    { startS: 500, endS: 530 },
  ];

  it("measures the fused piece when a span set is given", () => {
    const html = markup(<VideoPlayer source={MP4} spans={SPANS} />);
    // 60 + 30 seconds of source, however far apart they sit.
    expect(html).toContain("1:30");
  });

  it("measures the whole source when no span set is given", () => {
    const html = markup(<VideoPlayer source={MP4} />);
    expect(html).not.toContain("1:30");
    expect(html).toContain("0:00");
  });

  it("starts a fused piece at zero rather than at the first span's real time", () => {
    const html = markup(<VideoPlayer source={MP4} spans={SPANS} />);
    expect(html).toContain("0:00");
    expect(html).not.toContain("1:40");
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
    expect(html).toContain("max-w-[min(420px,calc(80vh*9/16)");
  });

  // Below the large breakpoint the stage's height is already fixed by the time a
  // stream reports it is portrait, so the cap has to defer to what the stage
  // says is left over, or the video pushes the chat out of the stage's box.
  it("defers to the stage's own cap for a portrait video", () => {
    const html = markup(<VideoPlayer source={MP4} width={1080} height={1920} />);
    expect(html).toContain("var(--stage-portrait-cap,100vw)");
  });
});
