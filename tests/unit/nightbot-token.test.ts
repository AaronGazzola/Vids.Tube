import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  forceNightbotRefresh,
  getNightbotToken,
  nightbotConfigured,
  resetNightbotTokenState,
  shouldRefresh,
  type NightbotExec,
} from "@/worker/lib/nightbot-token";

const ENV_KEYS = [
  "NIGHTBOT_CHANNEL_SEND_TOKEN",
  "NIGHTBOT_REFRESH_TOKEN",
  "NIGHTBOT_CLIENT_ID",
  "NIGHTBOT_CLIENT_SECRET",
  "NIGHTBOT_TOKEN_EXPIRES_AT",
] as const;

const saved: Record<string, string | undefined> = {};

const noopExec: NightbotExec = (_file, _args, _opts, callback) =>
  callback(null);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  resetNightbotTokenState();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
  resetNightbotTokenState();
});

describe("shouldRefresh", () => {
  const now = 1_700_000_000_000;
  const day = 24 * 60 * 60 * 1000;

  it("refreshes when expiry is unknown", () => {
    expect(shouldRefresh(null, now)).toBe(true);
  });

  it("refreshes under 5 days out", () => {
    expect(shouldRefresh(now + 4 * day, now)).toBe(true);
  });

  it("does not refresh over 5 days out", () => {
    expect(shouldRefresh(now + 6 * day, now)).toBe(false);
  });
});

describe("getNightbotToken", () => {
  it("returns null when nothing is configured", async () => {
    expect(nightbotConfigured()).toBe(false);
    const fetchCalls: string[] = [];
    const token = await getNightbotToken(async (url) => {
      fetchCalls.push(String(url));
      return jsonResponse(200, {});
    }, noopExec);
    expect(token).toBeNull();
    expect(fetchCalls).toEqual([]);
  });

  it("returns the cached token without fetching when expiry is far", async () => {
    process.env.NIGHTBOT_CHANNEL_SEND_TOKEN = "current";
    process.env.NIGHTBOT_TOKEN_EXPIRES_AT = new Date(
      Date.now() + 20 * 24 * 60 * 60 * 1000
    ).toISOString();
    const fetchCalls: string[] = [];
    const token = await getNightbotToken(async (url) => {
      fetchCalls.push(String(url));
      return jsonResponse(200, {});
    }, noopExec);
    expect(token).toBe("current");
    expect(fetchCalls).toEqual([]);
  });

  it("refreshes near expiry, rotates the pair, and persists via doppler", async () => {
    process.env.NIGHTBOT_CHANNEL_SEND_TOKEN = "old-access";
    process.env.NIGHTBOT_REFRESH_TOKEN = "old-refresh";
    process.env.NIGHTBOT_CLIENT_ID = "cid";
    process.env.NIGHTBOT_CLIENT_SECRET = "csecret";
    process.env.NIGHTBOT_TOKEN_EXPIRES_AT = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    const bodies: string[] = [];
    const execArgs: string[][] = [];
    const exec: NightbotExec = (_file, args, _opts, callback) => {
      execArgs.push(args);
      callback(null);
    };

    const token = await getNightbotToken(async (_url, init) => {
      bodies.push(String(init?.body));
      return jsonResponse(200, {
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 2592000,
      });
    }, exec);

    expect(token).toBe("new-access");
    expect(bodies[0]).toContain("grant_type=refresh_token");
    expect(bodies[0]).toContain("refresh_token=old-refresh");
    expect(bodies[0]).toContain("client_id=cid");
    expect(process.env.NIGHTBOT_CHANNEL_SEND_TOKEN).toBe("new-access");
    expect(process.env.NIGHTBOT_REFRESH_TOKEN).toBe("new-refresh");
    const setArgs = execArgs[0];
    expect(setArgs).toContain("NIGHTBOT_CHANNEL_SEND_TOKEN=new-access");
    expect(setArgs).toContain("NIGHTBOT_REFRESH_TOKEN=new-refresh");
  });

  it("backs off for an hour after a failed refresh", async () => {
    process.env.NIGHTBOT_CHANNEL_SEND_TOKEN = "old-access";
    process.env.NIGHTBOT_REFRESH_TOKEN = "old-refresh";
    process.env.NIGHTBOT_CLIENT_ID = "cid";
    process.env.NIGHTBOT_CLIENT_SECRET = "csecret";

    let fetches = 0;
    const failingFetch = async () => {
      fetches += 1;
      return jsonResponse(400, { message: "invalid_grant" });
    };

    const first = await forceNightbotRefresh(failingFetch, noopExec);
    const second = await forceNightbotRefresh(failingFetch, noopExec);
    expect(first).toBe("old-access");
    expect(second).toBe("old-access");
    expect(fetches).toBe(1);
  });
});
