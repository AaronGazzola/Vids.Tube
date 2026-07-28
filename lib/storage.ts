const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const VOD_BASE_URL = process.env.NEXT_PUBLIC_VOD_BASE_URL ?? "";

export function channelAssetUrl(path: string | null): string | null {
  if (!path) {
    return null;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/channel-assets/${path}`;
}

export function vodAssetUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }
  return `${VOD_BASE_URL}/${path}`;
}

export function channelAvatarUrl(
  channel:
    | { avatar_path?: string | null; remote_avatar_path?: string | null }
    | null
    | undefined
): string | null {
  if (!channel) {
    return null;
  }
  return (
    channelAssetUrl(channel.avatar_path ?? null) ??
    vodAssetUrl(channel.remote_avatar_path ?? null)
  );
}
