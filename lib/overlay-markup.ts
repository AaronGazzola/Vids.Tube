// The overlay's message dialect, parsed into runs. Deliberately pure: no React
// and no database access, so the dialect can be proven without rendering an
// overlay.
//
// Parsing never produces markup and rendering never turns a string into HTML —
// runs become elements. There is therefore no injection path and no sanitiser
// to get wrong.
//
// Malformed markup is emitted as the characters that were typed rather than
// thrown or dropped. An unclosed `**` is far more likely to be a streamer
// mid-edit than an attack, and showing what was typed is how they see it.

export type OverlayRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string | null;
};

type Marks = Omit<OverlayRun, "text">;

const PLAIN: Marks = {
  bold: false,
  italic: false,
  underline: false,
  color: null,
};

// Longest opener first: `**bold**` must win over `*italic*` at the same index.
const PAIRS: { token: string; mark: "bold" | "underline" | "italic" }[] = [
  { token: "**", mark: "bold" },
  { token: "__", mark: "underline" },
  { token: "*", mark: "italic" },
];

const COLOUR_OPEN = /^\{(#[0-9a-fA-F]{6})\|/;

// The index of the `}` closing a colour token opened at `from`, honouring any
// braces nested inside it. -1 when the token is never closed.
function colourCloseIndex(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      if (depth === 0) return i;
      depth -= 1;
    }
  }
  return -1;
}

function parseInto(text: string, marks: Marks, out: OverlayRun[]): void {
  let literal = "";
  const flush = () => {
    if (literal) out.push({ text: literal, ...marks });
    literal = "";
  };

  let i = 0;
  while (i < text.length) {
    const colour = COLOUR_OPEN.exec(text.slice(i));
    if (colour) {
      const contentFrom = i + colour[0].length;
      const close = colourCloseIndex(text, contentFrom);
      if (close !== -1) {
        flush();
        parseInto(
          text.slice(contentFrom, close),
          { ...marks, color: colour[1].toLowerCase() },
          out
        );
        i = close + 1;
        continue;
      }
    }

    const pair = PAIRS.find((p) => text.startsWith(p.token, i));
    if (pair) {
      const contentFrom = i + pair.token.length;
      const close = text.indexOf(pair.token, contentFrom);
      if (close !== -1) {
        flush();
        parseInto(
          text.slice(contentFrom, close),
          { ...marks, [pair.mark]: true },
          out
        );
        i = close + pair.token.length;
        continue;
      }
      // Unclosed: the opener is text, and the rest of the message still parses.
      literal += pair.token;
      i = contentFrom;
      continue;
    }

    literal += text[i];
    i += 1;
  }
  flush();
}

function sameMarks(a: OverlayRun, b: OverlayRun): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.color === b.color
  );
}

export function parseOverlayMessage(text: string): OverlayRun[] {
  if (!text) return [];
  const runs: OverlayRun[] = [];
  parseInto(text, PLAIN, runs);

  // Adjacent runs carrying the same marks become one element rather than two.
  const merged: OverlayRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && sameMarks(last, run)) last.text += run.text;
    else merged.push({ ...run });
  }
  return merged;
}

// What a viewer sees, so the cap counts words rather than punctuation the
// streamer never typed by hand.
export function visibleLength(text: string): number {
  return parseOverlayMessage(text).reduce((n, run) => n + run.text.length, 0);
}
