import {
  fetchLiveChatPage,
  fetchSubs,
  fetchVideoData,
  parseVideoId,
} from "@/lib/youtube";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log(
      "usage: tsx scripts/verify-youtube.ts <youtube video url or id>"
    );
    console.log(
      "(metrics work on any public video; chat needs a public LIVE broadcast)"
    );
    process.exit(1);
  }

  const videoId = parseVideoId(arg);
  if (!videoId) {
    console.error("could not parse a video id from:", arg);
    process.exit(1);
  }

  console.log("=== metrics ===");
  const v = await fetchVideoData(videoId);
  console.log(`  title: ${v.title}`);
  console.log(`  likes: ${v.likeCount}`);
  console.log(`  concurrentViewers: ${v.concurrentViewers}`);
  console.log(`  liveBroadcastContent: ${v.liveBroadcastContent}`);
  console.log(`  channelId: ${v.channelId}`);
  console.log(`  activeLiveChatId: ${v.activeLiveChatId ?? "(none — not live)"}`);
  const subs = await fetchSubs(v.channelId);
  console.log(`  subscribers: ${subs}`);

  if (v.activeLiveChatId) {
    console.log("\n=== chat (first page) ===");
    const page = await fetchLiveChatPage(v.activeLiveChatId);
    console.log(`  pollingIntervalMillis: ${page.pollingIntervalMillis}`);
    console.log(`  messages: ${page.messages.length}`);
    for (const m of page.messages.slice(0, 5)) {
      console.log(`  [${m.author}] ${m.text}`);
    }
  } else {
    console.log(
      "\n(no active live chat — pass a currently-live public broadcast to test chat)"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
