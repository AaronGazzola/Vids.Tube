export type StoredMessage = {
  externalMessageId: string | null;
  externalAuthorId: string | null;
  body: string;
  createdAt: string;
};

export type CandidateMessage = {
  messageId: string;
  authorChannelId: string;
  body: string;
  publishedAt: string;
};

export const EMPTY_BODY_TOLERANCE_MS = 15_000;
export const BODY_TOLERANCE_MS = 90_000;

export function normaliseBody(text: string): string {
  return text
    .replace(/[​-‍﻿]/g, "")
    .replace(/:[a-z0-9_+-]+:/gi, "")
    .replace(/[^\x20-\x7E]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function messageKey(authorId: string | null, body: string): string {
  return `${authorId ?? ""}|${normaliseBody(body)}`;
}

type Index = {
  byId: Set<string>;
  byKey: Map<string, number[]>;
};

export function indexStored(stored: StoredMessage[]): Index {
  const byId = new Set<string>();
  const byKey = new Map<string, number[]>();
  for (const m of stored) {
    if (m.externalMessageId) byId.add(m.externalMessageId);
    const key = messageKey(m.externalAuthorId, m.body);
    const at = new Date(m.createdAt).getTime();
    const list = byKey.get(key);
    if (list) list.push(at);
    else byKey.set(key, [at]);
  }
  return { byId, byKey };
}

export function isAlreadyStored(candidate: CandidateMessage, index: Index): boolean {
  if (index.byId.has(candidate.messageId)) return true;
  const key = messageKey(candidate.authorChannelId, candidate.body);
  const times = index.byKey.get(key);
  if (!times) return false;
  const at = new Date(candidate.publishedAt).getTime();
  const tolerance = normaliseBody(candidate.body)
    ? BODY_TOLERANCE_MS
    : EMPTY_BODY_TOLERANCE_MS;
  return times.some((t) => Math.abs(t - at) <= tolerance);
}

export function selectMissing(
  candidates: CandidateMessage[],
  stored: StoredMessage[]
): { missing: CandidateMessage[]; matchedById: number; matchedByBody: number } {
  const index = indexStored(stored);
  const missing: CandidateMessage[] = [];
  let matchedById = 0;
  let matchedByBody = 0;
  for (const c of candidates) {
    if (index.byId.has(c.messageId)) {
      matchedById += 1;
      continue;
    }
    if (isAlreadyStored(c, index)) {
      matchedByBody += 1;
      continue;
    }
    missing.push(c);
    index.byId.add(c.messageId);
    const key = messageKey(c.authorChannelId, c.body);
    const at = new Date(c.publishedAt).getTime();
    const list = index.byKey.get(key);
    if (list) list.push(at);
    else index.byKey.set(key, [at]);
  }
  return { missing, matchedById, matchedByBody };
}
