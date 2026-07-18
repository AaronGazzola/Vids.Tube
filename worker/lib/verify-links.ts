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
      console.error(
        `[verify] youtube link verified for user ${data[0].user_id} (${m.externalAuthorId})`
      );
    }
  }
}
