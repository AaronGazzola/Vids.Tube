import { thumbnailRejection } from "@/app/(app)/live/settings-tab";
import { describe, expect, it } from "vitest";

function fakeFile(type: string, size: number): File {
  const file = new File(["x"], "thumb", { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

const MB = 1024 * 1024;

describe("thumbnailRejection", () => {
  it("accepts the supported types at a sane size", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(thumbnailRejection(fakeFile(type, MB))).toBeNull();
    }
  });

  it("refuses an unsupported type at the moment it is chosen", () => {
    expect(thumbnailRejection(fakeFile("image/gif", MB))).toBe(
      "Unsupported file type — use JPG, PNG, or WebP."
    );
  });

  it("refuses a file over five megabytes", () => {
    expect(thumbnailRejection(fakeFile("image/png", 5 * MB + 1))).toBe(
      "File too large — thumbnail must be 5 MB or smaller."
    );
  });

  it("accepts exactly five megabytes", () => {
    expect(thumbnailRejection(fakeFile("image/png", 5 * MB))).toBeNull();
  });
});
