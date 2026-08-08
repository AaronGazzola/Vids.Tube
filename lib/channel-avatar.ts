import { createHash } from "node:crypto";
import { uploadToR2 } from "./r2";
import { upscaleGgphtAvatar } from "./youtube";

export type CachedAvatar = {
  path: string;
  sourceUrl: string;
};

// Cached copies are served with a one-year immutable cache header, so a changed
// avatar has to land on a new key or no viewer would ever see it. The key is
// versioned by the source URL, which YouTube changes whenever the image does.
export async function cacheChannelAvatar(
  youtubeChannelId: string,
  avatarUrl: string | null
): Promise<CachedAvatar | null> {
  if (!avatarUrl) return null;
  const sourceUrl = upscaleGgphtAvatar(avatarUrl);
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const version = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 8);
    const path = `avatars/${youtubeChannelId}-${version}.jpg`;
    await uploadToR2(path, bytes, "image/jpeg");
    return { path, sourceUrl };
  } catch (e) {
    console.error(`avatar cache failed for ${youtubeChannelId}:`, e);
    return null;
  }
}
