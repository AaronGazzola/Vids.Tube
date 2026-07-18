import { execFileSync } from "child_process";
import {
  forceNightbotRefresh,
  nightbotTokenDaysRemaining,
} from "../worker/lib/nightbot-token";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string) {
  console.log(`OK: ${msg}`);
}

async function main() {
  const required = [
    "NIGHTBOT_CHANNEL_SEND_TOKEN",
    "NIGHTBOT_REFRESH_TOKEN",
    "NIGHTBOT_CLIENT_ID",
    "NIGHTBOT_CLIENT_SECRET",
    "NIGHTBOT_TOKEN_EXPIRES_AT",
  ];
  for (const key of required) {
    if (!process.env[key]) fail(`${key} is not set (run via doppler run)`);
  }
  ok("all 5 Nightbot secrets present");

  const before = process.env.NIGHTBOT_CHANNEL_SEND_TOKEN!;
  const token = await forceNightbotRefresh();
  if (!token) fail("refresh returned no token");
  if (token === before) fail("refresh did not rotate the access token");
  ok("refresh grant succeeded and rotated the access token");

  const days = nightbotTokenDaysRemaining();
  if (days === null || days < 25) fail(`expiry not reset: ${days} days`);
  ok(`expiry recorded ${days.toFixed(1)} days out`);

  const me = await fetch("https://api.nightbot.tv/1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await me.json()) as { user?: { name?: string } };
  if (!me.ok || body.user?.name !== "@azanything") {
    fail(`new token not accepted by /1/me: ${me.status} ${JSON.stringify(body)}`);
  }
  ok(`new token authenticates as ${body.user!.name}`);

  const stored = execFileSync(
    "doppler",
    ["secrets", "get", "NIGHTBOT_CHANNEL_SEND_TOKEN", "--plain"],
    { encoding: "utf8" }
  ).trim();
  if (stored !== token) fail("Doppler read-back does not match the new token");
  ok("Doppler persistence verified by read-back");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
