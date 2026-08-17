import type { FeaturedAuthor } from "@/app/layout.types";

export type GreetingRow = {
  channelId: string;
  kind: "new" | "returning" | "batch";
  greetedAt: string;
  author: FeaturedAuthor;
};

export type GreetingGroup = {
  // Stable across polls, so a card already shown is recognised as the same one.
  id: string;
  kind: "new" | "returning" | "batch";
  greetedAt: string;
  authors: FeaturedAuthor[];
};

// A burst of arrivals is sent to chat as one combined message rather than one
// per chatter, so the overlay shows it as one card rather than inventing a
// second rule. The greeting step claims every chatter in the burst in the same
// pass, so a shared moment and a kind of `batch` is what identifies the burst.
//
// A new or returning greeting is always its own card: those are sent to chat
// individually too.
export function groupGreetings(rows: GreetingRow[]): GreetingGroup[] {
  const groups: GreetingGroup[] = [];
  const batches = new Map<string, GreetingGroup>();

  for (const row of rows) {
    if (row.kind !== "batch") {
      groups.push({
        id: `${row.kind}:${row.channelId}`,
        kind: row.kind,
        greetedAt: row.greetedAt,
        authors: [row.author],
      });
      continue;
    }
    const existing = batches.get(row.greetedAt);
    if (existing) {
      existing.authors.push(row.author);
      continue;
    }
    const group: GreetingGroup = {
      id: `batch:${row.greetedAt}`,
      kind: "batch",
      greetedAt: row.greetedAt,
      authors: [row.author],
    };
    batches.set(row.greetedAt, group);
    groups.push(group);
  }

  return groups;
}
