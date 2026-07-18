import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { enqueueNightbotSend, truncateForYoutube } from "@/worker/lib/replies";

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
  const prevToken = process.env.NIGHTBOT_CHANNEL_SEND_TOKEN;

  beforeEach(() => {
    process.env.NIGHTBOT_CHANNEL_SEND_TOKEN = "test-token";
  });

  afterEach(() => {
    if (prevToken === undefined) {
      delete process.env.NIGHTBOT_CHANNEL_SEND_TOKEN;
    } else {
      process.env.NIGHTBOT_CHANNEL_SEND_TOKEN = prevToken;
    }
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

    enqueueNightbotSend("first", sender, wait);
    enqueueNightbotSend("second", sender, wait);
    await new Promise((r) => setTimeout(r, 20));

    expect(calls).toEqual(["send:first", "wait:5200", "send:second"]);
  });

  it("skips without a token", async () => {
    delete process.env.NIGHTBOT_CHANNEL_SEND_TOKEN;
    const calls: string[] = [];
    const sender = async (text: string) => {
      calls.push(text);
      return new Response("ok", { status: 200 });
    };
    enqueueNightbotSend("dropped", sender);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toEqual([]);
  });
});
