const ROOTS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "ass",
  "bastard",
  "dick",
  "piss",
  "pussy",
  "slut",
  "whore",
  "cock",
  "wank",
  "twat",
  "prick",
  "bollocks",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "spastic",
  "coon",
  "tranny",
];

const SUFFIX = "(?:s|es|ed|ing|er|ers|in|y|head|hole|wad|face)?";
const PATTERN = new RegExp(`\\b(${ROOTS.join("|")})${SUFFIX}\\b`, "gi");

export type ChatSegment = { text: string; bad: boolean };

export function splitProfanity(text: string): ChatSegment[] {
  const segments: ChatSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const start = m.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), bad: false });
    segments.push({ text: m[0], bad: true });
    last = start + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bad: false });
  return segments.length ? segments : [{ text, bad: false }];
}

export function hasProfanity(text: string): boolean {
  PATTERN.lastIndex = 0;
  return PATTERN.test(text);
}
