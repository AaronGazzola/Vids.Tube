import { describe, expect, it } from "vitest";
import {
  mintInstallationToken,
  opaqueSubject,
  signOverlayToken,
  untrustedAudience,
  verifyOverlayToken,
  type OverlayTokenClaims,
} from "@/lib/overlay-token";

const SECRET = "a-secret-for-one-overlay";
const OTHER_SECRET = "a-secret-for-a-different-overlay";
const OVERLAY = "11111111-1111-4111-8111-111111111111";
const OTHER_OVERLAY = "22222222-2222-4222-8222-222222222222";
const CHANNEL = "33333333-3333-4333-8333-333333333333";
const OTHER_CHANNEL = "44444444-4444-4444-8444-444444444444";
const INSTALL = "55555555-5555-4555-8555-555555555555";
const NOW = 1_800_000_000;

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function mint(now = NOW) {
  return mintInstallationToken(
    { overlayId: OVERLAY, channelId: CHANNEL, installId: INSTALL, secret: SECRET },
    now
  );
}

describe("minting and verifying an overlay token", () => {
  it("round trips, naming the overlay, channel and installation", () => {
    const claims = verifyOverlayToken(mint(), SECRET, NOW + 1);
    expect(claims).toMatchObject({
      iss: "vids.tube",
      aud: OVERLAY,
      channel: CHANNEL,
      install: INSTALL,
      viewerKind: "source",
    });
  });

  it("expires twelve hours out", () => {
    const claims = verifyOverlayToken(mint(), SECRET, NOW + 1);
    expect(claims!.exp - claims!.iat).toBe(12 * 60 * 60);
  });

  it("refuses a payload edited after signing", () => {
    const token = mint();
    const [header, payload, signature] = token.split(".");
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as OverlayTokenClaims;
    const forged = `${header}.${b64url({ ...claims, channel: OTHER_CHANNEL })}.${signature}`;
    expect(verifyOverlayToken(forged, SECRET, NOW + 1)).toBeNull();
  });

  it("refuses a token minted for another overlay", () => {
    expect(verifyOverlayToken(mint(), OTHER_SECRET, NOW + 1)).toBeNull();
  });

  // The algorithm is ours, not the token's. A token that declares none must be
  // refused before its (absent) signature is considered.
  it("refuses an algorithm of none", () => {
    const claims = verifyOverlayToken(mint(), SECRET, NOW + 1)!;
    const forged = `${b64url({ alg: "none", typ: "JWT" })}.${b64url(claims)}.`;
    expect(verifyOverlayToken(forged, SECRET, NOW + 1)).toBeNull();
  });

  it("refuses a token past its expiry", () => {
    expect(verifyOverlayToken(mint(), SECRET, NOW + 12 * 60 * 60 + 1)).toBeNull();
  });

  it("refuses a token from another issuer", () => {
    const claims = verifyOverlayToken(mint(), SECRET, NOW + 1)!;
    const elsewhere = signOverlayToken({ ...claims, iss: "elsewhere" }, SECRET);
    expect(verifyOverlayToken(elsewhere, SECRET, NOW + 1)).toBeNull();
  });

  it("returns null for a malformed token rather than throwing", () => {
    expect(verifyOverlayToken("", SECRET)).toBeNull();
    expect(verifyOverlayToken("not.a.token", SECRET)).toBeNull();
    expect(verifyOverlayToken("only-one-part", SECRET)).toBeNull();
    expect(verifyOverlayToken("a.b", SECRET)).toBeNull();
  });

  it("reads the audience without trusting it, and survives rubbish", () => {
    expect(untrustedAudience(mint())).toBe(OVERLAY);
    expect(untrustedAudience("not-a-token")).toBeNull();
  });
});

describe("the opaque subject", () => {
  it("is stable for the same overlay, channel and subject", () => {
    expect(opaqueSubject(OVERLAY, CHANNEL, "bob", SECRET)).toBe(
      opaqueSubject(OVERLAY, CHANNEL, "bob", SECRET)
    );
  });

  it("differs across overlays, so two games cannot recognise one person", () => {
    expect(opaqueSubject(OVERLAY, CHANNEL, "bob", SECRET)).not.toBe(
      opaqueSubject(OTHER_OVERLAY, CHANNEL, "bob", OTHER_SECRET)
    );
  });

  it("differs across channels, so one game cannot follow a person between them", () => {
    expect(opaqueSubject(OVERLAY, CHANNEL, "bob", SECRET)).not.toBe(
      opaqueSubject(OVERLAY, OTHER_CHANNEL, "bob", SECRET)
    );
  });

  it("does not carry the subject in the clear", () => {
    expect(opaqueSubject(OVERLAY, CHANNEL, "bob", SECRET)).not.toContain("bob");
  });
});
