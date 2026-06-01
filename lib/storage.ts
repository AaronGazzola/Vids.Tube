const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export function channelAssetUrl(path: string | null): string | null {
  if (!path) {
    return null;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/channel-assets/${path}`;
}
