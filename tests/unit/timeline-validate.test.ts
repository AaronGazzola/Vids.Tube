import { describe, expect, it } from "vitest";
import { validateTimelinePayload } from "@/lib/timeline";

const scores = { humour: 50, interest: 60, engagement: 70 };

function payload(overrides: Record<string, unknown> = {}) {
  return {
    sections: [
      {
        start_s: 0,
        end_s: 600,
        label: "debugging the deploy",
        summary: "chasing a failing build",
        tags: ["coding"],
        scores,
      },
    ],
    moments: [
      {
        start_s: 120,
        end_s: 120,
        kind: "joke",
        label: "mustache tangent",
        summary: "chat piles on",
        tags: ["banter"],
        scores,
      },
    ],
    chapters: [
      { start_s: 0, title: "Intro" },
      { start_s: 600, title: "Deploy" },
    ],
    ...overrides,
  };
}

describe("validateTimelinePayload", () => {
  it("accepts a valid payload", () => {
    const result = validateTimelinePayload(payload(), 1200);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.sections).toHaveLength(1);
    expect(result.moments).toHaveLength(1);
    expect(result.chapters).toHaveLength(2);
  });

  it("rejects a score above 100", () => {
    const result = validateTimelinePayload(
      payload({
        sections: [
          { ...payload().sections[0], scores: { ...scores, humour: 140 } },
        ],
      }),
      1200
    );
    expect(result).toEqual({
      error: "sections[0]: scores.humour must be between 0 and 100, got 140",
    });
  });

  it("rejects a missing score criterion", () => {
    const result = validateTimelinePayload(
      payload({
        sections: [
          {
            ...payload().sections[0],
            scores: { humour: 10, interest: 20 },
          },
        ],
      }),
      1200
    );
    expect(result).toEqual({
      error: "sections[0]: scores.engagement is missing or not a number",
    });
  });

  it("rejects a non-integer score", () => {
    const result = validateTimelinePayload(
      payload({
        sections: [
          { ...payload().sections[0], scores: { ...scores, interest: 61.5 } },
        ],
      }),
      1200
    );
    expect(result).toEqual({
      error: "sections[0]: scores.interest must be an integer, got 61.5",
    });
  });

  it("rejects a timestamp past the stream duration", () => {
    const result = validateTimelinePayload(payload(), 300);
    expect(result).toEqual({
      error: "sections[0]: end_s 600 is past the stream duration 300",
    });
  });

  it("rejects end_s before start_s", () => {
    const result = validateTimelinePayload(
      payload({
        sections: [{ ...payload().sections[0], start_s: 500, end_s: 400 }],
      }),
      1200
    );
    expect(result).toEqual({
      error: "sections[0]: end_s 400 is before start_s 500",
    });
  });

  it("accepts a section with a null end_s", () => {
    const result = validateTimelinePayload(
      payload({ sections: [{ ...payload().sections[0], end_s: null }] }),
      1200
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.sections[0].end_s).toBeNull();
  });

  it("accepts a moment whose end_s equals start_s", () => {
    const result = validateTimelinePayload(payload(), 1200);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.moments[0].start_s).toBe(result.moments[0].end_s);
  });

  it("rejects chapters that are not strictly increasing", () => {
    const result = validateTimelinePayload(
      payload({
        chapters: [
          { start_s: 0, title: "Intro" },
          { start_s: 600, title: "Deploy" },
          { start_s: 600, title: "Still deploy" },
        ],
      }),
      1200
    );
    expect(result).toEqual({
      error:
        "chapters[2]: start_s 600 is not after the previous chapter's 600",
    });
  });

  it("rejects a first chapter that does not start at the beginning", () => {
    const result = validateTimelinePayload(
      payload({ chapters: [{ start_s: 42, title: "Late" }] }),
      1200
    );
    expect(result).toEqual({
      error: "chapters[0]: the first chapter must start at 0, got 42",
    });
  });

  it("normalises a first chapter within the epsilon to exactly 0", () => {
    const result = validateTimelinePayload(
      payload({ chapters: [{ start_s: 0.8, title: "Intro" }] }),
      1200
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.chapters[0].start_s).toBe(0);
  });

  it("rejects unexpected top-level keys", () => {
    const result = validateTimelinePayload(payload({ extra: [] }), 1200);
    expect(result).toEqual({ error: "payload has unexpected keys: extra" });
  });

  it("rejects a missing top-level key", () => {
    const { sections, moments } = payload();
    const result = validateTimelinePayload({ sections, moments }, 1200);
    expect(result).toEqual({ error: "payload is missing chapters" });
  });

  it("rejects an empty label", () => {
    const result = validateTimelinePayload(
      payload({ sections: [{ ...payload().sections[0], label: "   " }] }),
      1200
    );
    expect(result).toEqual({
      error: "sections[0]: label must be a non-empty string",
    });
  });

  it("rejects a non-string tag", () => {
    const result = validateTimelinePayload(
      payload({ sections: [{ ...payload().sections[0], tags: ["ok", 3] }] }),
      1200
    );
    expect(result).toEqual({
      error: "sections[0]: every tag must be a non-empty string",
    });
  });

  it("rejects a moment with an empty kind", () => {
    const result = validateTimelinePayload(
      payload({ moments: [{ ...payload().moments[0], kind: "" }] }),
      1200
    );
    expect(result).toEqual({
      error: "moments[0]: kind must be a non-empty string",
    });
  });
});
