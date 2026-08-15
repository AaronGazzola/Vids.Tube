export type OverlayCommandDeclaration = {
  keyword: string;
  description: string;
  cooldown_s?: number;
  max_per_stream?: number;
};

// The same pattern the command registry enforces on its own keywords, so an
// overlay cannot declare something the parser could never match.
const KEYWORD_RE = /^[a-z0-9_]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A malformed entry is dropped rather than thrown on, as with the settings
// declaration: this is authored by an overlay, and one bad entry must not take
// away every command the streamer's chatters can use.
export function parseOverlayCommands(raw: unknown): OverlayCommandDeclaration[] {
  if (!Array.isArray(raw)) return [];
  const commands: OverlayCommandDeclaration[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const { keyword, description } = entry;
    if (typeof keyword !== "string" || !KEYWORD_RE.test(keyword)) continue;
    if (seen.has(keyword)) continue;
    if (typeof description !== "string" || !description) continue;

    const command: OverlayCommandDeclaration = { keyword, description };
    if (
      typeof entry.cooldown_s === "number" &&
      Number.isFinite(entry.cooldown_s) &&
      entry.cooldown_s >= 0
    ) {
      command.cooldown_s = Math.round(entry.cooldown_s);
    }
    if (
      typeof entry.max_per_stream === "number" &&
      Number.isFinite(entry.max_per_stream) &&
      entry.max_per_stream > 0
    ) {
      command.max_per_stream = Math.round(entry.max_per_stream);
    }

    seen.add(keyword);
    commands.push(command);
  }

  return commands;
}
