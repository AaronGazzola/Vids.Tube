import { describe, expect, it } from "vitest";
import {
  isRenditionPath,
  parseRenditionPath,
  LADDER_RENDITIONS,
} from "@/lib/renditions";
import { isLoopbackAddress } from "@/lib/loopback";

describe("rendition paths", () => {
  it("recognises every ladder path for a channel", () => {
    for (const rendition of LADDER_RENDITIONS) {
      expect(isRenditionPath(`owner${rendition.suffix}`)).toBe(true);
      expect(parseRenditionPath(`owner${rendition.suffix}`)?.channelPath).toBe(
        "owner"
      );
    }
  });

  it("does not treat a channel path as a rendition path", () => {
    expect(isRenditionPath("owner")).toBe(false);
    expect(isRenditionPath("azanything")).toBe(false);
    expect(parseRenditionPath("owner")).toBeNull();
  });

  it("does not treat a bare suffix as a rendition path", () => {
    expect(isRenditionPath("_720")).toBe(false);
    expect(isRenditionPath("_540")).toBe(false);
  });

  it("does not match a path that merely contains the suffix", () => {
    expect(isRenditionPath("owner_720_live")).toBe(false);
  });
});

describe("loopback detection", () => {
  it("accepts the addresses MediaMTX reports for a local publish", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("127.0.0.1:54321")).toBe(true);
    expect(isLoopbackAddress("[::1]:54321")).toBe(true);
  });

  it("rejects every remote address", () => {
    expect(isLoopbackAddress("203.0.113.7")).toBe(false);
    expect(isLoopbackAddress("203.0.113.7:1935")).toBe(false);
    expect(isLoopbackAddress("10.0.0.4")).toBe(false);
    expect(isLoopbackAddress("2001:db8::1")).toBe(false);
  });

  it("rejects a missing or empty address rather than defaulting open", () => {
    expect(isLoopbackAddress(undefined)).toBe(false);
    expect(isLoopbackAddress(null)).toBe(false);
    expect(isLoopbackAddress("")).toBe(false);
  });

  it("rejects an address that merely starts with the loopback digits", () => {
    expect(isLoopbackAddress("127.0.0.10")).toBe(false);
    expect(isLoopbackAddress("1127.0.0.1")).toBe(false);
  });
});
