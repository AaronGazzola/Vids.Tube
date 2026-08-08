import { describe, expect, it } from "vitest";
import {
  CHAT_GEOMETRY,
  CHROME_ABOVE,
  CHROME_BELOW,
  HEART_GEOMETRY,
  INPUT_GEOMETRY,
  MOBILE_CHROME_REF_WIDTH,
} from "@/components/mobile-chrome";

// Measured by sampling the pixels of data/Screenshot_20260717-120823(1).png,
// a 1080x2400 phone capture of a YouTube live stream in portrait. Every figure
// is in that screenshot's own pixels, which is also the model's reference scale.
//
// The preview exists so the owner can place overlays without going live, so a
// drift here shows up as an overlay that sits right in the preview and wrong on
// a phone. These numbers are the source of truth; change them only by measuring
// the screenshot again.
const SHOT = {
  width: 1080,
  height: 2400,
  // The video's first and last rows, found where the flat black chrome gives way
  // to picture.
  videoTop: 195,
  videoBottom: 2114,
  // The channel header above the video, and its gap.
  headerTop: 110,
  // The chat input's own band, below the video.
  inputTop: 2115,
  inputBottom: 2194,
  // The lowest chat text pixel, and the block's horizontal extent.
  chatLowestText: 2036,
  chatLeftmostText: 41,
  chatRightmostText: 1080 - 181,
  // The red heart glyph.
  heartLeft: 965,
  heartRight: 1025,
  heartTop: 2000,
  heartBottom: 2055,
};

const videoHeight = SHOT.videoBottom - SHOT.videoTop + 1;

describe("the phone screenshot the model is built from", () => {
  it("shows the video at exactly 9:16, which the whole model assumes", () => {
    expect(SHOT.width).toBe(MOBILE_CHROME_REF_WIDTH);
    expect(videoHeight).toBe(1920);
    expect(videoHeight / SHOT.width).toBeCloseTo(16 / 9, 3);
  });

  it("accounts for every row of the phone", () => {
    const above = SHOT.videoTop;
    const below = SHOT.height - SHOT.videoBottom - 1;
    expect(above + videoHeight + below).toBe(SHOT.height);
  });
});

describe("chrome above and below the video", () => {
  it("reserves the height the channel header actually occupies", () => {
    const header = SHOT.videoTop - SHOT.headerTop;
    expect(CHROME_ABOVE).toBeCloseTo(header, -1);
  });

  it("reserves the height the chat input actually occupies", () => {
    const input = SHOT.inputBottom - SHOT.inputTop + 1;
    expect(CHROME_BELOW).toBeCloseTo(input, -1);
  });
});

describe("the chat block sits where the phone puts it", () => {
  it("clears the bottom of the video by the measured amount", () => {
    const measured = SHOT.videoBottom - SHOT.chatLowestText;
    // The block's own edge sits below its last glyph by the line box's descent,
    // so the constant is allowed to be a little under the measured text gap and
    // must not be the far smaller figure it carried before.
    expect(CHAT_GEOMETRY.bottom).toBeLessThanOrEqual(measured);
    expect(CHAT_GEOMETRY.bottom).toBeGreaterThan(measured - 20);
  });

  it("starts where the avatars start", () => {
    // A round avatar's leftmost lit pixel sits just inside its box.
    expect(CHAT_GEOMETRY.left).toBeLessThanOrEqual(SHOT.chatLeftmostText);
    expect(CHAT_GEOMETRY.left).toBeGreaterThan(SHOT.chatLeftmostText - 12);
  });

  it("stops short of the heart column", () => {
    const measuredRightInset = SHOT.width - SHOT.chatRightmostText;
    // Text wraps before the container's edge, so the reserved gutter is at most
    // the measured one.
    expect(CHAT_GEOMETRY.right).toBeLessThanOrEqual(measuredRightInset);
    expect(CHAT_GEOMETRY.right).toBeGreaterThan(measuredRightInset - 25);
  });
});

describe("the heart button", () => {
  it("is centred where the glyph was measured", () => {
    const cx = (SHOT.heartLeft + SHOT.heartRight) / 2;
    const cy = (SHOT.heartTop + SHOT.heartBottom) / 2;
    const modelRightInsetToCentre = HEART_GEOMETRY.right + HEART_GEOMETRY.size / 2;
    const modelBottomInsetToCentre = HEART_GEOMETRY.bottom + HEART_GEOMETRY.size / 2;
    expect(modelRightInsetToCentre).toBeCloseTo(SHOT.width - cx, -1);
    expect(modelBottomInsetToCentre).toBeCloseTo(SHOT.videoBottom - cy, -1);
  });

  it("draws a glyph the size the phone draws", () => {
    const measured = SHOT.heartRight - SHOT.heartLeft + 1;
    expect(HEART_GEOMETRY.glyph).toBeCloseTo(measured, -1);
  });

  it("stays inside the video", () => {
    expect(HEART_GEOMETRY.bottom).toBeGreaterThanOrEqual(0);
    expect(HEART_GEOMETRY.right).toBeGreaterThanOrEqual(0);
  });
});

describe("the chat input", () => {
  it("does not lie across the bottom of the picture", () => {
    // It runs from the row after the video's last, so none of it overlaps.
    expect(SHOT.inputTop).toBe(SHOT.videoBottom + 1);
    expect(INPUT_GEOMETRY.overlap).toBe(0);
  });

  it("is as tall as the band it was measured in", () => {
    expect(INPUT_GEOMETRY.height).toBeCloseTo(
      SHOT.inputBottom - SHOT.inputTop + 1,
      -1
    );
  });
});
