import {
  AVATAR_SIZE_BUCKETS,
  avatarSizeBucket,
  withAvatarSize,
} from "@/lib/avatar-size";
import { describe, expect, it } from "vitest";

const LARGEST = AVATAR_SIZE_BUCKETS[AVATAR_SIZE_BUCKETS.length - 1];

describe("avatarSizeBucket", () => {
  it("returns the bucket at the boundary rather than the next one up", () => {
    expect(avatarSizeBucket(64)).toBe(64);
    expect(avatarSizeBucket(128)).toBe(128);
    expect(avatarSizeBucket(800)).toBe(800);
  });

  it("rounds up between boundaries", () => {
    expect(avatarSizeBucket(65)).toBe(128);
    expect(avatarSizeBucket(129)).toBe(256);
    expect(avatarSizeBucket(257)).toBe(400);
  });

  it("accounts for a device pixel ratio above one", () => {
    expect(avatarSizeBucket(64, 2)).toBe(128);
    expect(avatarSizeBucket(100, 3)).toBe(400);
  });

  it("never exceeds the largest bucket", () => {
    expect(avatarSizeBucket(5000, 4)).toBe(LARGEST);
  });

  it("treats a ratio below one as one, since a smaller request would look soft", () => {
    expect(avatarSizeBucket(128, 0.5)).toBe(128);
  });
});

describe("withAvatarSize", () => {
  it("rewrites the size token", () => {
    expect(withAvatarSize("https://x/photo.jpg=s64-c", 400)).toBe(
      "https://x/photo.jpg=s400-c"
    );
  });

  it("leaves a url without a size token untouched", () => {
    const stored = "https://storage/avatars/abc.png";
    expect(withAvatarSize(stored, 400)).toBe(stored);
  });
});
