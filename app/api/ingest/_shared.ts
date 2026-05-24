import { supabaseAdmin } from "@/supabase/admin-client";

export function hasValidIngestSecret(request: Request): boolean {
  const provided = request.headers.get("x-ingest-secret");
  const expected = process.env.INGEST_SHARED_SECRET;
  return !!expected && provided === expected;
}

export { supabaseAdmin };
