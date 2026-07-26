import type { BufferedMessage } from "../jobs/score";
import { supabaseAdmin } from "../supabase";

const CODE_RE = /^[A-Z2-9]{6}$/;

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
    const { data, error } = await supabaseAdmin
      .from("youtube_links")
      .update({
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("verify_code", code)
      .eq("youtube_channel_id", m.externalAuthorId!)
      .is("verified_at", null)
      .select("user_id");
    if (error) {
      console.error("link verification update failed:", error);
      continue;
    }
    if (data?.length) {
      const userId = data[0].user_id;
      console.error(
        `[verify] youtube link verified for user ${userId} (${m.externalAuthorId})`
      );
      const { data: merge, error: mergeErr } = await supabaseAdmin.rpc(
        "merge_youtube_identity",
        { p_user_id: userId }
      );
      if (mergeErr) {
        console.error("identity merge failed:", mergeErr);
      } else {
        console.error(`[verify] identity merge for user ${userId}:`, merge);
      }
    }
  }
}
