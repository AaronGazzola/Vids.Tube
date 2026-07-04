import { supabaseAdmin } from "@/supabase/admin-client";

export function hasValidIngestSecret(request: Request): boolean {
  const provided = request.headers.get("x-ingest-secret");
  const expected = process.env.INGEST_SHARED_SECRET;
  return !!expected && provided === expected;
}

const FALLBACK_CHANNEL_SLUG = process.env.INGEST_CHANNEL_SLUG ?? "azanything";

export type IngestChannel = { id: string; slug: string };

export async function resolveIngestChannel(
  mtxPath: string | null
): Promise<IngestChannel | null> {
  if (mtxPath) {
    const { data: byPath, error: byPathError } = await supabaseAdmin
      .from("channels")
      .select("id, slug")
      .eq("slug", mtxPath)
      .maybeSingle();
    if (byPathError) {
      console.error(byPathError);
      throw new Error("Failed to resolve ingest channel");
    }
    if (byPath) {
      return byPath;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("channels")
    .select("id, slug")
    .eq("slug", FALLBACK_CHANNEL_SLUG)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to resolve ingest channel");
  }
  return data ?? null;
}

export { supabaseAdmin };
