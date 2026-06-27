import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function opt(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`${name} must be a number, got: ${v}`);
  return n;
}

export const workerConfig = {
  supabase: {
    url: req("NEXT_PUBLIC_SUPABASE_URL"),
    secretKey: req("SUPABASE_SECRET_KEY"),
  },
  streamHost: req("NEXT_PUBLIC_STREAM_HOST"),
  mtxPath: opt("STREAM_MTX_PATH", "owner"),
  bin: {
    whisper: opt("WHISPER_BIN", "whisper-cli"),
    whisperModel: opt("WHISPER_MODEL", ""),
    claude: opt("CLAUDE_BIN", "claude"),
    claudeModel: opt("CLAUDE_MODEL", "sonnet"),
    ffmpeg: opt("FFMPEG_BIN", "ffmpeg"),
    ffprobe: opt("FFPROBE_BIN", "ffprobe"),
  },
  transcription: {
    chunkSeconds: num("TRANSCRIBE_CHUNK_SECONDS", 30),
    whisperThreads: num("WHISPER_THREADS", 8),
  },
  loop: {
    pollMs: num("WORKER_POLL_MS", 10_000),
    lockLeaseMs: num("WORKER_LOCK_LEASE_MS", 60_000),
  },
  hlsUrl(): string {
    return `${this.streamHost.replace(/\/$/, "")}/${this.mtxPath}/index.m3u8`;
  },
};
