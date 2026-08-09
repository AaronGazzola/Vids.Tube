// Every reply the worker sends is posted to YouTube by Nightbot and read back by
// the poller. Recognising those echoes used to compare exact text, which assumes
// the transport is lossless. It is not: YouTube truncates at 200 characters and
// Nightbot prepends two zero-width characters, so the text that returns is a
// truncated, padded version of what was sent and never matched.

// Shorter than the platform's own limit, so the comparison holds whether or not
// the message came back cut.
export const ECHO_PREFIX_CHARS = 80;

// Whitespace is removed rather than collapsed. Collapsing assumes the transport
// replaces a newline with a space; it deletes it instead, so a reply written
// across two lines returned as one word-joined line and never matched its own
// key. Removing whitespace on both sides is agnostic to what the transport does
// with it.
export function normaliseForEcho(text: string): string {
  return text
    .replace(/[​-‍﻿⁠]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function echoKey(text: string): string {
  return normaliseForEcho(text).slice(0, ECHO_PREFIX_CHARS);
}

export function isEchoOf(sent: string, incoming: string): boolean {
  const a = echoKey(sent);
  const b = echoKey(incoming);
  if (!a || !b) return false;
  return a === b;
}
