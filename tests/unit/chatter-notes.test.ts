import { describe, expect, it } from "vitest";
import {
  CHECKIN_MAX_AGE_DAYS,
  fromStored,
  needsNotes,
  type Note,
  parseNotes,
  pruneNotes,
  snapshotFromStored,
  toStored,
} from "@/worker/lib/chatter-notes";

const NOW = Date.parse("2026-08-19T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
  return new Date(NOW - n * DAY).toISOString().slice(0, 10);
}

function note(kind: Note["kind"], days: number, text = `${kind} ${days}`): Note {
  return { kind, raisedAt: daysAgo(days), text };
}

describe("parseNotes", () => {
  it("reads the two kinds", () => {
    const notes = parseNotes(
      [
        "STANDING|2026-08-19|studying architecture",
        "CHECKIN|2026-08-18|exam on Thursday",
      ].join("\n")
    );
    expect(notes).toEqual([
      { kind: "standing", raisedAt: "2026-08-19", text: "studying architecture" },
      { kind: "checkin", raisedAt: "2026-08-18", text: "exam on Thursday" },
    ]);
  });

  it("keeps a pipe inside the text", () => {
    const notes = parseNotes("STANDING|2026-08-19|likes a|b testing");
    expect(notes[0].text).toBe("likes a|b testing");
  });

  it("yields nothing for a malformed answer rather than throwing", () => {
    const notes = parseNotes(
      [
        "I'd be happy to help! Here are the notes:",
        "MAYBE|2026-08-19|wrong kind",
        "STANDING|19th August|wrong date",
        "STANDING|2026-08-19|",
        "STANDING|2026-08-19",
        "",
      ].join("\n")
    );
    expect(notes).toEqual([]);
  });

  it("ignores prose around well-formed lines", () => {
    const notes = parseNotes(
      ["Sure, here you go:", "CHECKIN|2026-08-19|had the flu", "Hope that helps!"].join("\n")
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe("had the flu");
  });
});

describe("pruneNotes", () => {
  it("drops a check-in past its shelf life and keeps one inside it", () => {
    const kept = pruneNotes(
      [note("checkin", CHECKIN_MAX_AGE_DAYS + 1, "stale"), note("checkin", CHECKIN_MAX_AGE_DAYS - 1, "fresh")],
      NOW
    );
    expect(kept.map((n) => n.text)).toEqual(["fresh"]);
  });

  it("never expires a standing point", () => {
    const kept = pruneNotes([note("standing", 900, "studies architecture")], NOW);
    expect(kept).toHaveLength(1);
  });

  it("keeps only the three most recent check-ins", () => {
    const kept = pruneNotes(
      [note("checkin", 1), note("checkin", 2), note("checkin", 3), note("checkin", 4)],
      NOW
    );
    expect(kept.filter((n) => n.kind === "checkin")).toHaveLength(3);
    expect(kept.map((n) => n.text)).not.toContain("checkin 4");
  });

  it("keeps at most eight points in total", () => {
    const many = Array.from({ length: 9 }, (_, i) => note("standing", i + 1));
    expect(pruneNotes(many, NOW)).toHaveLength(8);
  });

  it("keeps the most recent when trimming to eight", () => {
    const many = Array.from({ length: 9 }, (_, i) => note("standing", i + 1));
    const kept = pruneNotes(many, NOW);
    expect(kept.map((n) => n.text)).not.toContain("standing 9");
    expect(kept.map((n) => n.text)).toContain("standing 1");
  });

  it("leaves an empty list empty", () => {
    expect(pruneNotes([], NOW)).toEqual([]);
  });
});

describe("needsNotes", () => {
  const current = { messageCount: 40, streamsAttended: 7 };

  it("writes when nothing is stored", () => {
    expect(needsNotes(current, null)).toBe(true);
  });

  it("skips an unchanged chatter", () => {
    expect(needsNotes(current, { messageCount: 40, streamsAttended: 7 })).toBe(false);
  });

  it("writes when they have spoken since", () => {
    expect(needsNotes(current, { messageCount: 39, streamsAttended: 7 })).toBe(true);
  });

  it("writes when they have attended since", () => {
    expect(needsNotes(current, { messageCount: 40, streamsAttended: 6 })).toBe(true);
  });
});

describe("stored shape", () => {
  it("round-trips", () => {
    const notes = [note("standing", 1), note("checkin", 2)];
    expect(fromStored(toStored(notes))).toEqual(notes);
  });

  it("discards rows that are not notes", () => {
    expect(
      fromStored([
        { text: "ok", kind: "standing", raised_at: "2026-08-19" },
        { text: "", kind: "standing", raised_at: "2026-08-19" },
        { text: "bad kind", kind: "guess", raised_at: "2026-08-19" },
        { text: "no date", kind: "checkin" },
        null,
        "not an object",
      ])
    ).toEqual([{ text: "ok", kind: "standing", raisedAt: "2026-08-19" }]);
  });

  it("treats a missing notes column as no notes", () => {
    expect(fromStored(undefined)).toEqual([]);
    expect(fromStored({ notes: [] })).toEqual([]);
  });

  it("reads a snapshot only when both counts are numbers", () => {
    expect(snapshotFromStored({ message_count: 3, streams_attended: 1 })).toEqual({
      messageCount: 3,
      streamsAttended: 1,
    });
    expect(snapshotFromStored({ message_count: 3 })).toBeNull();
    expect(snapshotFromStored(null)).toBeNull();
  });
});
