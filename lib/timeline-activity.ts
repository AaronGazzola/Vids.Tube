import type { ActivityBucket, ChatLine } from "@/lib/timeline.types";

export const ACTIVITY_BUCKET_S = 60;

export function chatActivitySeries(
  messages: ChatLine[],
  bucketS: number = ACTIVITY_BUCKET_S
): ActivityBucket[] {
  if (messages.length === 0 || bucketS <= 0) {
    return [];
  }

  const buckets = new Map<number, { count: number; authors: Set<string> }>();

  for (const message of messages) {
    if (!Number.isFinite(message.atS) || message.atS < 0) {
      continue;
    }
    const index = Math.floor(message.atS / bucketS);
    const bucket = buckets.get(index) ?? { count: 0, authors: new Set() };
    bucket.count += 1;
    bucket.authors.add(message.author);
    buckets.set(index, bucket);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, bucket]) => ({
      atS: index * bucketS,
      messages: bucket.count,
      uniqueAuthors: bucket.authors.size,
    }));
}

export function formatActivitySeries(series: ActivityBucket[]): string {
  if (series.length === 0) {
    return "(no chat activity recorded)";
  }
  return series
    .map(
      (bucket) =>
        `${bucket.atS}s: ${bucket.messages} messages, ${bucket.uniqueAuthors} chatters`
    )
    .join("\n");
}
