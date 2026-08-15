// What a step actually did, carried from a step script back to the pass.
//
// A step used to be judged by whether its process exited without an error. On
// 8-Aug-2026 the chat download printed `TypeError: fetch failed`, exited zero,
// saved nothing, and was recorded as having worked. An exit code cannot carry
// that difference, so each step states its own result and is judged on it.

export const STEP_RESULT_PREFIX = "::result ";

export function formatStepResult(result: Record<string, unknown>): string {
  return `${STEP_RESULT_PREFIX}${JSON.stringify(result)}`;
}

// The last result line wins. A step script may print progress lines that happen
// to contain the prefix, and what it says at the end is its conclusion.
export function parseStepResult(
  output: string
): Record<string, unknown> | null {
  const lines = output.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line.startsWith(STEP_RESULT_PREFIX)) continue;
    try {
      const parsed = JSON.parse(line.slice(STEP_RESULT_PREFIX.length));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // A malformed line is not a result. Keep looking further back rather than
      // treating the step as silent, since an earlier line may be sound.
    }
  }
  return null;
}

export function printStepResult(result: Record<string, unknown>): void {
  console.log(formatStepResult(result));
}
