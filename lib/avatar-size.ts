// Ggpht serves any size from a token in the URL. Requesting one matched to the
// rendered size keeps an enlarged overlay sharp without making a small one pull
// a full-size image. Buckets, rather than exact pixels, so a drag does not mint
// a fresh URL — and a fresh fetch — on every pointer move.
export const AVATAR_SIZE_BUCKETS = [64, 128, 256, 400, 800] as const;

export function avatarSizeBucket(
  renderedPx: number,
  devicePixelRatio = 1
): number {
  const required = Math.max(0, renderedPx) * Math.max(1, devicePixelRatio);
  for (const bucket of AVATAR_SIZE_BUCKETS) {
    if (bucket >= required) return bucket;
  }
  return AVATAR_SIZE_BUCKETS[AVATAR_SIZE_BUCKETS.length - 1];
}

// Only ggpht carries a size token. Anything else — a stored channel asset, a
// generated placeholder — is returned untouched rather than guessed at.
export function withAvatarSize(url: string, bucket: number): string {
  if (!/=s\d+-c/.test(url)) return url;
  return url.replace(/=s\d+-c/, `=s${bucket}-c`);
}
