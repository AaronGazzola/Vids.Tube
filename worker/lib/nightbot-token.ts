import { execFile } from "child_process";
import path from "path";

const TOKEN_URL = "https://api.nightbot.tv/oauth2/token";
const RENEW_AHEAD_MS = 5 * 24 * 60 * 60 * 1000;
const FAILURE_BACKOFF_MS = 60 * 60 * 1000;
const REPO_ROOT = path.resolve(__dirname, "..", "..");

export type NightbotFetch = typeof fetch;
export type NightbotExec = (
  file: string,
  args: string[],
  options: { cwd: string },
  callback: (error: Error | null) => void
) => void;

type TokenState = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
};

let state: TokenState | null = null;
let lastFailureAt = 0;

function loadState(): TokenState {
  if (!state) {
    const raw = process.env.NIGHTBOT_TOKEN_EXPIRES_AT;
    const parsed = raw ? Date.parse(raw) : NaN;
    state = {
      accessToken: process.env.NIGHTBOT_CHANNEL_SEND_TOKEN || null,
      refreshToken: process.env.NIGHTBOT_REFRESH_TOKEN || null,
      expiresAt: Number.isFinite(parsed) ? parsed : null,
    };
  }
  return state;
}

export function resetNightbotTokenState(): void {
  state = null;
  lastFailureAt = 0;
}

function hasRefreshMaterials(): boolean {
  return Boolean(
    loadState().refreshToken &&
      process.env.NIGHTBOT_CLIENT_ID &&
      process.env.NIGHTBOT_CLIENT_SECRET
  );
}

export function nightbotConfigured(): boolean {
  return Boolean(loadState().accessToken) || hasRefreshMaterials();
}

export function shouldRefresh(
  expiresAt: number | null,
  now: number = Date.now()
): boolean {
  return expiresAt === null || expiresAt - now < RENEW_AHEAD_MS;
}

function persistToDoppler(exec: NightbotExec): Promise<void> {
  const s = loadState();
  return new Promise((resolve) => {
    exec(
      "doppler",
      [
        "secrets",
        "set",
        `NIGHTBOT_CHANNEL_SEND_TOKEN=${s.accessToken}`,
        `NIGHTBOT_REFRESH_TOKEN=${s.refreshToken}`,
        `NIGHTBOT_TOKEN_EXPIRES_AT=${new Date(s.expiresAt!).toISOString()}`,
        "--silent",
      ],
      { cwd: REPO_ROOT },
      (error) => {
        if (error) {
          console.error(
            "nightbot token refreshed but Doppler persist failed — next worker run may hold a rotated-out refresh token:",
            error
          );
        }
        resolve();
      }
    );
  });
}

async function refresh(
  fetchFn: NightbotFetch,
  exec: NightbotExec
): Promise<string | null> {
  const s = loadState();
  if (!hasRefreshMaterials()) {
    return s.accessToken;
  }
  if (Date.now() - lastFailureAt < FAILURE_BACKOFF_MS) {
    return s.accessToken;
  }
  try {
    const res = await fetchFn(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: s.refreshToken!,
        client_id: process.env.NIGHTBOT_CLIENT_ID!,
        client_secret: process.env.NIGHTBOT_CLIENT_SECRET!,
      }).toString(),
    });
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!res.ok || !json.access_token || !json.refresh_token) {
      lastFailureAt = Date.now();
      console.error(
        `nightbot token refresh failed (${res.status}): ${JSON.stringify(json)}`
      );
      return s.accessToken;
    }
    s.accessToken = json.access_token;
    s.refreshToken = json.refresh_token;
    s.expiresAt = Date.now() + (json.expires_in ?? 2592000) * 1000;
    process.env.NIGHTBOT_CHANNEL_SEND_TOKEN = s.accessToken;
    process.env.NIGHTBOT_REFRESH_TOKEN = s.refreshToken;
    process.env.NIGHTBOT_TOKEN_EXPIRES_AT = new Date(s.expiresAt).toISOString();
    await persistToDoppler(exec);
    return s.accessToken;
  } catch (e) {
    lastFailureAt = Date.now();
    console.error("nightbot token refresh error:", e);
    return s.accessToken;
  }
}

export async function getNightbotToken(
  fetchFn: NightbotFetch = fetch,
  exec: NightbotExec = execFile as unknown as NightbotExec
): Promise<string | null> {
  const s = loadState();
  if (!nightbotConfigured()) {
    return null;
  }
  if (s.accessToken && !shouldRefresh(s.expiresAt)) {
    return s.accessToken;
  }
  return refresh(fetchFn, exec);
}

export async function forceNightbotRefresh(
  fetchFn: NightbotFetch = fetch,
  exec: NightbotExec = execFile as unknown as NightbotExec
): Promise<string | null> {
  return refresh(fetchFn, exec);
}

export function nightbotTokenDaysRemaining(): number | null {
  const s = loadState();
  return s.expiresAt === null
    ? null
    : (s.expiresAt - Date.now()) / (24 * 60 * 60 * 1000);
}
