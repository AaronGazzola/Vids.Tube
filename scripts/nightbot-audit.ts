const token = process.env.NIGHTBOT_CHANNEL_SEND_TOKEN;
if (!token) {
  console.error("NIGHTBOT_CHANNEL_SEND_TOKEN not set");
  process.exit(1);
}

const FILTERS = [
  "blacklist",
  "caps",
  "emotes",
  "links",
  "repetitions",
  "symbols",
] as const;

async function get(path: string) {
  const res = await fetch(`https://api.nightbot.tv/1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function main() {
  const me = await get("me");
  console.log("me:", me.status, JSON.stringify(me.body?.user?.name ?? me.body));

  for (const f of FILTERS) {
    const r = await get(`spam_protection/${f}`);
    const s = r.body?.spamProtection ?? r.body?.filter ?? r.body;
    console.log(
      `spam_protection/${f}: ${r.status}`,
      s && typeof s === "object"
        ? `enabled=${s.enabled} silent=${s.silent} length=${s.length ?? "-"}`
        : JSON.stringify(s)
    );
  }

  const cmds = await get("commands");
  console.log(
    "commands:",
    cmds.status,
    Array.isArray(cmds.body?.commands)
      ? cmds.body.commands.map((c: { name: string }) => c.name).join(", ") ||
          "(none)"
      : JSON.stringify(cmds.body)
  );

  const defaults = await get("commands/default");
  console.log(
    "default commands:",
    defaults.status,
    Array.isArray(defaults.body?.commands)
      ? defaults.body.commands
          .map(
            (c: { name: string; enabled: boolean }) =>
              `${c.name}${c.enabled ? "" : " (off)"}`
          )
          .join(", ") || "(none)"
      : JSON.stringify(defaults.body)
  );

  const timers = await get("timers");
  console.log(
    "timers:",
    timers.status,
    Array.isArray(timers.body?.timers)
      ? timers.body.timers
          .map(
            (t: { name: string; enabled: boolean }) =>
              `${t.name}${t.enabled ? "" : " (off)"}`
          )
          .join(", ") || "(none)"
      : JSON.stringify(timers.body)
  );
}

main();
