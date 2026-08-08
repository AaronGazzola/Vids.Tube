import { cacheChannelAvatar } from "@/lib/channel-avatar";
import { fetchChannelSnippets } from "@/lib/youtube";
import type { BufferedMessage } from "../jobs/score";
import { supabaseAdmin } from "../supabase";

const CODE_RE = /^[A-Z2-9]{6}$/;

// Best-effort: capture a fresh high-res avatar for the claimed identity and
// cache it to R2 so the claimed channel keeps a durable copy.
async function recacheAvatar(youtubeChannelId: string): Promise<void> {
  try {
    const [snippet] = await fetchChannelSnippets([youtubeChannelId]);
    const cached = await cacheChannelAvatar(
      youtubeChannelId,
      snippet?.avatarUrl ?? null
    );
    if (!cached) return;
    await supabaseAdmin
      .from("channels")
      .update({
        remote_avatar_path: cached.path,
        avatar_source_url: cached.sourceUrl,
      })
      .eq("youtube_channel_id", youtubeChannelId);
  } catch (e) {
    console.error(`avatar re-cache failed for ${youtubeChannelId}:`, e);
  }
}

// A viewer proves ownership of their claimed YouTube channel by posting their
// verify code in the owner's YouTube chat from that channel.
export async function processLinkVerifications(
  batch: BufferedMessage[]
): Promise<void> {
  const candidates = batch.filter(
    (m) =>
      m.origin === "youtube" &&
      m.externalAuthorId &&
      CODE_RE.test(m.text.trim())
  );
  for (const m of candidates) {
    const code = m.text.trim();
    const authorChannelId = m.externalAuthorId!;

    // The code alone identifies the vids.tube account; the channel that posted
    // it is the YouTube identity being linked.
    const { data: link, error: findErr } = await supabaseAdmin
      .from("youtube_links")
      .select("user_id")
      .eq("verify_code", code)
      .is("verified_at", null)
      .maybeSingle();
    if (findErr) {
      console.error("link lookup failed:", findErr);
      continue;
    }
    if (!link) {
      continue;
    }

    // Don't let a channel already verified by another account be re-linked.
    const { data: taken } = await supabaseAdmin
      .from("youtube_links")
      .select("user_id")
      .eq("youtube_channel_id", authorChannelId)
      .not("verified_at", "is", null)
      .maybeSingle();
    if (taken && taken.user_id !== link.user_id) {
      console.error(
        `[verify] channel ${authorChannelId} already linked to another account; ignoring`
      );
      continue;
    }

    const { error: updErr } = await supabaseAdmin
      .from("youtube_links")
      .update({
        youtube_channel_id: authorChannelId,
        youtube_handle: m.authorName ?? m.author ?? null,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", link.user_id)
      .is("verified_at", null);
    if (updErr) {
      console.error("link verification update failed:", updErr);
      continue;
    }

    const userId = link.user_id;
    console.error(
      `[verify] youtube link verified for user ${userId} (${authorChannelId})`
    );
    const { data: merge, error: mergeErr } = await supabaseAdmin.rpc(
      "merge_youtube_identity",
      { p_user_id: userId }
    );
    if (mergeErr) {
      console.error("identity merge failed:", mergeErr);
    } else {
      console.error(`[verify] identity merge for user ${userId}:`, merge);
      await recacheAvatar(authorChannelId);
    }
  }
}
