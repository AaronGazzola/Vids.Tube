import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  enqueueNightbotBridge,
  enqueueNightbotSend,
  truncateForYoutube,
} from "@/worker/lib/replies";
import { resetNightbotTokenState } from "@/worker/lib/nightbot-token";

describe("truncateForYoutube", () => {
  it("passes short messages through", () => {
    expect(truncateForYoutube("hello")).toBe("hello");
  });

  it("truncates long messages to 400 chars on a word boundary", () => {
    const text = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
    const out = truncateForYoutube(text);
    expect(out.length).toBeLessThanOrEqual(400);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, -1).endsWith("word")).toBe(false);
  });
});

describe("enqueueNightbotSend", () => {
  const ENV_KEYS = [
    "NIGHTBOT_CHANNEL_SEND_TOKEN",
    "NIGHTBOT_REFRESH_TOKEN",
    "NIGHTBOT_CLIENT_ID",
    "NIGHTBOT_CLIENT_SECRET",
    "NIGHTBOT_TOKEN_EXPIRES_AT",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  const token = async () => "test-token";

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.NIGHTBOT_CHANNEL_SEND_TOKEN = "test-token";
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

  it("spaces consecutive sends by the configured interval", async () => {
    const calls: string[] = [];
    const sender = async (text: string) => {
      calls.push(`send:${text}`);
      return new Response("ok", { status: 200 });
    };
    const wait = async (ms: number) => {
      calls.push(`wait:${ms}`);
    };

    enqueueNightbotSend("first", sender, wait, token, token);
    enqueueNightbotSend("second", sender, wait, token, token);
    await new Promise((r) => setTimeout(r, 20));

    expect(calls).toEqual(["send:first", "wait:5200", "send:second"]);
  });

  it("skips when nothing is configured", async () => {
    delete process.env.NIGHTBOT_CHANNEL_SEND_TOKEN;
    resetNightbotTokenState();
    const calls: string[] = [];
    const sender = async (text: string) => {
      calls.push(text);
      return new Response("ok", { status: 200 });
    };
    enqueueNightbotSend("dropped", sender);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toEqual([]);
  });

  it("refreshes and retries once on a 401", async () => {
    const calls: string[] = [];
    const sender = async (text: string, tok: string) => {
      calls.push(`send:${text}:${tok}`);
      return tok === "fresh-token"
        ? new Response("ok", { status: 200 })
        : new Response("unauthorized", { status: 401 });
    };
    const refresh = async () => {
      calls.push("refresh");
      return "fresh-token";
    };

    enqueueNightbotSend("hello", sender, async () => {}, token, refresh);
    await new Promise((r) => setTimeout(r, 20));

    expect(calls).toEqual([
      "send:hello:test-token",
      "refresh",
      "send:hello:fresh-token",
    ]);
  });

  it("drops the message when the post-refresh retry also fails", async () => {
    const calls: string[] = [];
    const sender = async (text: string, tok: string) => {
      calls.push(`send:${text}:${tok}`);
      return new Response("unauthorized", { status: 401 });
    };
    const refresh = async () => {
      calls.push("refresh");
      return "fresh-token";
    };

    enqueueNightbotSend("hello", sender, async () => {}, token, refresh);
    await new Promise((r) => setTimeout(r, 20));

    expect(calls).toEqual([
      "send:hello:test-token",
      "refresh",
      "send:hello:fresh-token",
    ]);
  });

  it("sends replies before bridged messages", async () => {
    const sent: string[] = [];
    const sender = async (text: string) => {
      sent.push(text);
      return new Response("ok", { status: 200 });
    };
    const wait = async () => {};

    enqueueNightbotBridge("bridge-1", sender, wait, token, token);
    enqueueNightbotBridge("bridge-2", sender, wait, token, token);
    enqueueNightbotSend("reply-1", sender, wait, token, token);
    await new Promise((r) => setTimeout(r, 30));

    expect(sent).toEqual(["bridge-1", "reply-1", "bridge-2"]);
  });

  it("drops the oldest bridged message beyond the buffer", async () => {
    const sent: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const sender = async (text: string) => {
      sent.push(text);
      await gate;
      return new Response("ok", { status: 200 });
    };
    const wait = async () => {};

    for (let i = 1; i <= 7; i++) {
      enqueueNightbotBridge(`b${i}`, sender, wait, token, token);
    }
    release();
    await new Promise((r) => setTimeout(r, 30));

    expect(sent).toEqual(["b1", "b3", "b4", "b5", "b6", "b7"]);
  });

  it("truncates bridged messages to 400 chars", async () => {
    const sent: string[] = [];
    const sender = async (text: string) => {
      sent.push(text);
      return new Response("ok", { status: 200 });
    };

    enqueueNightbotBridge(
      `viewer: ${"word ".repeat(120)}`,
      sender,
      async () => {},
      token,
      token
    );
    await new Promise((r) => setTimeout(r, 20));

    expect(sent).toHaveLength(1);
    expect(sent[0].length).toBeLessThanOrEqual(400);
    expect(sent[0].endsWith("…")).toBe(true);
  });
});
