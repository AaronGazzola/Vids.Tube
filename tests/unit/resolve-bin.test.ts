import { needsShell, underThisUsersHome } from "../../worker/lib/resolve-bin";
import { homedir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("underThisUsersHome", () => {
  it("moves a Windows path out of another user's home into this one", () => {
    expect(underThisUsersHome("C:\\Users\\aaron\\whisper\\Release\\whisper-cli.exe")).toBe(
      join(homedir(), "whisper", "Release", "whisper-cli.exe")
    );
  });

  it("handles a forward-slashed Windows path, which is how tools often report one", () => {
    expect(underThisUsersHome("C:/Users/aaron/whisper/ggml-base.en.bin")).toBe(
      join(homedir(), "whisper", "ggml-base.en.bin")
    );
  });

  it("moves a Linux home path", () => {
    expect(underThisUsersHome("/home/alice/.local/bin/claude")).toBe(
      join(homedir(), ".local", "bin", "claude")
    );
  });

  it("moves a macOS home path", () => {
    expect(underThisUsersHome("/Users/alice/.local/bin/claude")).toBe(
      join(homedir(), ".local", "bin", "claude")
    );
  });

  it("leaves a path that is not inside anyone's home alone", () => {
    expect(underThisUsersHome("/usr/local/bin/ffmpeg")).toBeNull();
    expect(underThisUsersHome("C:\\Program Files\\ffmpeg\\ffmpeg.exe")).toBeNull();
  });

  it("leaves a bare command name alone", () => {
    expect(underThisUsersHome("claude")).toBeNull();
    expect(underThisUsersHome("claude.cmd")).toBeNull();
  });

  it("returns nothing when the path already points at this user", () => {
    const mine = join(homedir(), "whisper", "x.exe");
    expect(underThisUsersHome(mine)).toBeNull();
  });
});

describe("needsShell", () => {
  it("shells out for a script, which is not an executable", () => {
    // Spawning claude.cmd without a shell fails on Windows, and spawning it
    // through one fails differently when the file does not exist, which is how
    // scoring broke silently.
    expect(needsShell("claude.cmd")).toBe(true);
    expect(needsShell("thing.BAT")).toBe(true);
  });

  it("does not shell out for a real executable", () => {
    expect(needsShell("claude")).toBe(false);
    expect(needsShell("claude.exe")).toBe(false);
    expect(needsShell("/usr/local/bin/ffmpeg")).toBe(false);
  });
});
