import { uploadToR2 } from "./r2";
import { upscaleGgphtAvatar } from "./youtube";

export async function cacheChannelAvatar(
  youtubeChannelId: string,
  avatarUrl: string | null
): Promise<string | null> {
  if (!avatarUrl) return null;
  try {
    const res = await fetch(upscaleGgphtAvatar(avatarUrl));
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const key = `avatars/${youtubeChannelId}.jpg`;
    await uploadToR2(key, bytes, "image/jpeg");
    return key;
  } catch (e) {
    console.error(`avatar cache failed for ${youtubeChannelId}:`, e);
    return null;
  }
}
