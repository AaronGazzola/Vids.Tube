function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function placeholderAvatar(seed: string | null | undefined): string {
  const key = (seed && seed.trim()) || "viewer";
  const h = hashSeed(key);
  const hue = h % 360;
  const bg = `hsl(${hue},58%,52%)`;
  const fg = `hsl(${(hue + 40) % 360},70%,88%)`;

  const rects: string[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if (((h >>> (y * 3 + x)) & 1) === 0) continue;
      rects.push(`<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`);
      if (x < 2) rects.push(`<rect x="${4 - x}" y="${y}" width="1.02" height="1.02"/>`);
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5">` +
    `<rect width="5" height="5" fill="${bg}"/>` +
    `<g fill="${fg}">${rects.join("")}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
