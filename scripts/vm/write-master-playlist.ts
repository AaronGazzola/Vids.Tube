import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildMasterPlaylist, MASTER_PLAYLIST_NAME } from "../../lib/master-playlist";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const channelPath = flag("--path") ?? "owner";
const root = flag("--root") ?? "/var/lib/vids-tube/hls";
const target = join(root, channelPath, MASTER_PLAYLIST_NAME);

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, buildMasterPlaylist(channelPath), "utf8");

console.log(`wrote ${target}`);
console.log(buildMasterPlaylist(channelPath));
