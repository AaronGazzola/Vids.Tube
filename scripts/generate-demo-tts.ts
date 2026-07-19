import { writeFile } from "node:fs/promises";
import { synthesizeTts } from "../worker/lib/tts";

const TEXT = "big shoutout to the mods, you keep this place cozy";
const OUT = "public/demo/tts-sample.mp3";

async function main() {
  const audio = await synthesizeTts(TEXT);
  if (!audio) {
    console.error("synthesis failed");
    process.exit(1);
  }
  await writeFile(OUT, Buffer.from(audio));
  console.error(`wrote ${OUT} (${audio.byteLength} bytes)`);
}

main();
