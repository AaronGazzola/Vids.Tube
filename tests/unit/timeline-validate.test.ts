import { describe, expect, it } from "vitest";
import { validateTimelinePayload } from "@/lib/timeline";

const DURATION = 3600;
const scores = { humour: 10, interest: 20, engagement: 30 };

function span(start_s: number, end_s: number, label = "part") {
  return { start_s, end_s, label, scores };
}

function thread(title: string, spans = [span(0, 100)]) {
  return { title, summary: "what it is", tags: ["subject"], scores, spans };
}

function moment(overrides: Record<string, unknown> = {}) {
  return {
    start_s: 200,
    peak_s: 220,
    end_s: 240,
    kind: "joke",
    label: "the punchline",
    summary: "",
    tags: [],
    scores,
    thread: null,
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    threads: [thread("account linking")],
    moments: [moment()],
    chapters: [{ start_s: 0, title: "Intro" }],
    ...overrides,
  };
}

function ok(raw: unknown) {
  const result = validateTimelinePayload(raw, DURATION);
  if ("error" in result) {
    throw new Error(`expected a valid payload, got: ${result.error}`);
  }
  return result;
}

function failure(raw: unknown): string {
  const result = validateTimelinePayload(raw, DURATION);
  if (!("error" in result)) {
    throw new Error("expected the payload to be rejected");
  }
  return result.error;
}

describe("the payload's shape", () => {
  it("accepts a well-formed payload intact", () => {
    const result = ok(payload());
    expect(result.threads).toHaveLength(1);
    expect(result.threads[0].spans).toHaveLength(1);
    expect(result.moments).toHaveLength(1);
    expect(result.chapters).toHaveLength(1);
  });

  it("refuses anything that is not an object", () => {
    expect(failure([])).toContain("must be a JSON object");
  });

  it("refuses a payload missing threads", () => {
    const raw = payload();
    delete (raw as Record<string, unknown>).threads;
    expect(failure(raw)).toContain("missing threads");
  });

  it("refuses a payload carrying the old sections key", () => {
    expect(failure({ ...payload(), sections: [] })).toContain("unexpected keys");
  });
});

describe("threads", () => {
  it("refuses a thread with no spans", () => {
    expect(failure(payload({ threads: [thread("empty", [])] }))).toContain(
      "spans must be a non-empty array"
    );
  });

  it("refuses a thread with no title", () => {
    expect(
      failure(payload({ threads: [{ ...thread("x"), title: "  " }] }))
    ).toContain("title must be a non-empty string");
  });

  it("keeps several spans on one thread", () => {
    const result = ok(
      payload({
        threads: [
          thread("account linking", [
            span(100, 200, "designed"),
            span(1600, 1700, "tested"),
            span(3000, 3100, "tested again"),
          ]),
        ],
      })
    );
    expect(result.threads[0].spans).toHaveLength(3);
  });

  it("puts a thread's spans in time order", () => {
    const result = ok(
      payload({
        threads: [thread("t", [span(500, 600, "late"), span(100, 200, "early")])],
      })
    );
    expect(result.threads[0].spans.map((s) => s.label)).toEqual([
      "early",
      "late",
    ]);
  });
});

describe("spans", () => {
  it("refuses a span ending before it starts", () => {
    expect(failure(payload({ threads: [thread("t", [span(200, 100)])] }))).toContain(
      "is before start_s"
    );
  });

  it("refuses a span past the stream duration", () => {
    expect(
      failure(payload({ threads: [thread("t", [span(0, DURATION + 1)])] }))
    ).toContain("past the stream duration");
  });

  it("refuses a span with no label", () => {
    expect(
      failure(payload({ threads: [thread("t", [{ ...span(0, 10), label: "" }])] }))
    ).toContain("label must be a non-empty string");
  });

  it("refuses a span with a non-integer score", () => {
    expect(
      failure(
        payload({
          threads: [
            thread("t", [
              { ...span(0, 10), scores: { ...scores, humour: 10.5 } },
            ]),
          ],
        })
      )
    ).toContain("must be an integer");
  });
});

describe("moments", () => {
  it("refuses a moment with no duration, because it cannot be cut", () => {
    expect(failure(payload({ moments: [moment({ end_s: 200 })] }))).toContain(
      "a clip can be cut from"
    );
  });

  it("refuses a peak before the window", () => {
    expect(failure(payload({ moments: [moment({ peak_s: 100 })] }))).toContain(
      "falls outside the window"
    );
  });

  it("refuses a peak after the window", () => {
    expect(failure(payload({ moments: [moment({ peak_s: 999 })] }))).toContain(
      "falls outside the window"
    );
  });

  it("defaults a missing peak to the start of the window", () => {
    const result = ok(payload({ moments: [moment({ peak_s: undefined })] }));
    expect(result.moments[0].peak_s).toBe(200);
  });

  it("keeps a thread reference that resolves", () => {
    const result = ok(
      payload({
        threads: [thread("account linking")],
        moments: [moment({ thread: "Account Linking" })],
      })
    );
    expect(result.moments[0].thread).toBe("Account Linking");
  });

  it("drops a thread reference that does not resolve, rather than failing", () => {
    const result = ok(payload({ moments: [moment({ thread: "nothing here" })] }));
    expect(result.moments[0].thread).toBeNull();
    expect(result.threads).toHaveLength(1);
  });
});

describe("chapters", () => {
  it("refuses a spine that does not start at the beginning", () => {
    expect(
      failure(payload({ chapters: [{ start_s: 60, title: "Late" }] }))
    ).toContain("must start at 0");
  });

  it("refuses a spine that does not move forward", () => {
    expect(
      failure(
        payload({
          chapters: [
            { start_s: 0, title: "One" },
            { start_s: 0, title: "Two" },
          ],
        })
      )
    ).toContain("is not after the previous");
  });

  it("pulls a nearly-zero first chapter back to the beginning", () => {
    const result = ok(payload({ chapters: [{ start_s: 0.4, title: "Intro" }] }));
    expect(result.chapters[0].start_s).toBe(0);
  });
});
