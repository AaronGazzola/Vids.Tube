// Finds a tool wherever this machine and this user happen to keep it.
//
// Doppler holds one value per setting, shared by every machine and every user
// account. This PC runs the broadcast under one Windows user and development
// under another, and the configured paths are absolute into one user's home:
//
//   WHISPER_BIN    C:\Users\<other>\whisper\Release\whisper-cli.exe
//   WHISPER_MODEL  C:\Users\<other>\whisper\ggml-base.en.bin
//   FFMPEG_BIN     C:\Users\<other>\AppData\...\ffmpeg.exe
//   CLAUDE_BIN     claude.cmd, the npm shim, replaced on one account by a
//                  native claude.exe under ~/.local/bin
//
// So switching accounts broke scoring and transcription, and the fix each time
// was to edit the shared value, which broke the other account instead. The
// 9-Aug-2026 broadcast scored nobody because of it.
//
// Configuration is now a hint. A path into another user's home is retried under
// this user's home, and a name that will not run falls back to the usual
// install locations. Nothing needs editing when the account changes.
import { execFile } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const resolved = new Map<string, string>();

// `.cmd` and `.bat` are scripts a shell interprets rather than executables, so
// spawning them without a shell fails on Windows. Matches worker/lib/exec.ts.
export function needsShell(command: string): boolean {
  return /\.(cmd|bat)$/i.test(command);
}

// The same path under whoever is logged in now. `C:\Users\alice\whisper\x.exe`
// becomes `C:\Users\bob\whisper\x.exe`, and a Unix `/home/alice/...` likewise.
// Returns null when the path is not inside somebody's home to begin with.
export function underThisUsersHome(configured: string): string | null {
  const m = configured.match(/^([A-Za-z]:[\\/]Users[\\/]|\/home\/|\/Users\/)([^\\/]+)[\\/](.+)$/);
  if (!m) return null;
  const tail = m[3];
  const swapped = join(homedir(), tail);
  return swapped === configured ? null : swapped;
}

// Each tool is asked in its own dialect. ffmpeg takes `-version` and rejects
// `--version`, so probing every tool the same way reports a working ffmpeg as
// missing.
async function runs(bin: string, probeArgs: string[]): Promise<boolean> {
  try {
    await execFileAsync(bin, probeArgs, {
      timeout: 20_000,
      shell: needsShell(bin),
    });
    return true;
  } catch {
    return false;
  }
}

// Tried in order, first that runs wins. Configuration goes first so an explicit
// override still counts, and is skipped rather than obeyed when it does not run.
export async function resolveBinary(
  label: string,
  configured: string,
  candidates: string[] = [],
  probeArgs: string[] = ["--version"]
): Promise<string> {
  const cached = resolved.get(label);
  if (cached) return cached;

  const swapped = underThisUsersHome(configured);
  const tried: string[] = [];
  for (const candidate of [configured, ...(swapped ? [swapped] : []), ...candidates]) {
    if (!candidate || tried.includes(candidate)) continue;
    tried.push(candidate);
    if (await runs(candidate, probeArgs)) {
      if (candidate !== configured) {
        console.error(`[bin] ${label}: ${configured} did not run, using ${candidate}`);
      }
      resolved.set(label, candidate);
      return candidate;
    }
  }

  throw new Error(
    `${label} could not be found. Tried: ${tried.join(", ")}. Install it, or point its ` +
      `configured path at somewhere this user can reach.`
  );
}

// A data file rather than a program, so existence is the test.
export function resolveFile(configured: string): string | null {
  if (!configured) return null;
  if (existsSync(configured)) return configured;
  const swapped = underThisUsersHome(configured);
  if (swapped && existsSync(swapped)) {
    console.error(`[bin] file: ${configured} is not here, using ${swapped}`);
    return swapped;
  }
  return null;
}

function claudeCandidates(): string[] {
  const home = homedir();
  const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");
  return [
    // Bare name first: Windows resolves it to claude.exe on PATH, and every
    // Unix install puts `claude` on PATH.
    "claude",
    join(home, ".local", "bin", "claude"),
    join(home, ".local", "bin", "claude.exe"),
    join(home, ".claude", "local", "claude"),
    join(appData, "npm", "claude.cmd"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    "claude.exe",
    "claude.cmd",
  ];
}

export async function resolveClaude(configured: string): Promise<string> {
  return resolveBinary("claude", configured, claudeCandidates());
}

export const FFMPEG_CANDIDATES = ["ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/bin/ffmpeg"];
export const WHISPER_CANDIDATES = [
  "whisper-cli",
  "whisper-cli.exe",
  "/opt/homebrew/bin/whisper-cli",
];
// ffmpeg and its family answer `-version`. Asking for `--version` fails.
export const FFMPEG_PROBE = ["-version"];

export async function resolveFfmpeg(configured: string): Promise<string> {
  return resolveBinary("ffmpeg", configured, FFMPEG_CANDIDATES, FFMPEG_PROBE);
}

export async function resolveFfprobe(configured: string): Promise<string> {
  return resolveBinary(
    "ffprobe",
    configured,
    ["ffprobe", "/opt/homebrew/bin/ffprobe", "/usr/bin/ffprobe"],
    FFMPEG_PROBE
  );
}

export async function resolveWhisper(configured: string): Promise<string> {
  return resolveBinary("whisper", configured, WHISPER_CANDIDATES);
}

// For a preflight, which must report what a machine can do rather than throw.
export async function findBinary(
  label: string,
  configured: string,
  candidates: string[] = [],
  probeArgs?: string[]
): Promise<string | null> {
  try {
    return await resolveBinary(label, configured, candidates, probeArgs);
  } catch {
    return null;
  }
}

export async function findClaude(configured: string): Promise<string | null> {
  return findBinary("claude", configured, claudeCandidates());
}
