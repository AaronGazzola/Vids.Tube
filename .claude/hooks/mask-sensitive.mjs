// Rewrites a tool result before the session receives it, so a sensitive value
// never enters the transcript rather than being redacted after it already has.
//
// Any fault here degrades to no masking rather than to a broken tool call: a
// hook that throws would break every command, which is a worse failure than the
// one it guards against. Faults go to standard error so they stay visible.
import { maskNotice, maskSensitive } from "./sensitive-mask.mjs";

function passThrough() {
  process.stdout.write("{}");
  process.exit(0);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  // Reading a value deliberately is a single-command act, visible in the
  // command itself, rather than a setting that can be left switched on.
  if (process.env.VIDSTUBE_REVEAL === "1") passThrough();

  const raw = await readStdin();
  if (!raw.trim()) passThrough();

  const payload = JSON.parse(raw);
  const response = payload.tool_response;
  if (typeof response !== "string" || !response) passThrough();

  const { text, masked } = maskSensitive(response);
  if (!masked.length) passThrough();

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        updatedToolOutput: `${text}${maskNotice(masked)}`,
      },
    })
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(`mask-sensitive hook failed: ${e?.message ?? e}`);
  passThrough();
});
