// Every balanced { ... } in the text, found by walking braces while respecting
// strings and escapes. Slicing from the first brace to the last one breaks the
// moment a reply carries two objects, or an object followed by a closing remark.
function balancedObjects(text: string): string[] {
  const found: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }
    if (char === "}") {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start !== -1) {
          found.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }
  return found;
}

// The payload is the biggest object that parses: a reply may open with a short
// example or close with a remark, and either would defeat a positional slice.
export function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(
    (match) => match[1]
  );
  const haystacks = fenced.length > 0 ? [...fenced, trimmed] : [trimmed];

  const candidates = haystacks
    .flatMap(balancedObjects)
    .sort((a, b) => b.length - a.length);

  if (candidates.length === 0) {
    throw new Error(
      `No JSON object found in claude output: ${raw.slice(0, 500)}`
    );
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `No parsable JSON object in claude output (${(lastError as Error)?.message}): ${raw.slice(0, 500)}`
  );
}
