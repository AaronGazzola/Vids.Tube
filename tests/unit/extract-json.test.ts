import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/extract-json";

describe("pulling the payload out of a model's reply", () => {
  it("reads a bare object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("reads an object inside a fence", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("ignores prose before and after", () => {
    expect(extractJson('Here you go:\n{"a":1}\nHope that helps.')).toEqual({
      a: 1,
    });
  });

  it("takes the payload when a short example precedes it", () => {
    const raw = 'For example {"x":1}. The answer:\n{"a":1,"b":[1,2,3]}';
    expect(extractJson(raw)).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it("takes the payload when a remark object follows it", () => {
    const raw = '{"a":1,"b":[1,2,3]}\n{"note":"done"}';
    expect(extractJson(raw)).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it("is not fooled by braces inside strings", () => {
    expect(extractJson('{"a":"} not the end {"}')).toEqual({
      a: "} not the end {",
    });
  });

  it("is not fooled by an escaped quote before a brace", () => {
    expect(extractJson('{"a":"say \\"} \\" then"}')).toEqual({
      a: 'say "} " then',
    });
  });

  it("keeps nested objects whole", () => {
    expect(extractJson('{"a":{"b":{"c":1}}}')).toEqual({
      a: { b: { c: 1 } },
    });
  });

  it("falls back to a smaller object when the biggest will not parse", () => {
    const raw = '{"a":1}\n{"broken": ,}';
    expect(extractJson(raw)).toEqual({ a: 1 });
  });

  it("refuses a reply with no object at all", () => {
    expect(() => extractJson("no json here")).toThrow(/No JSON object found/);
  });

  it("refuses a reply whose only object is malformed", () => {
    expect(() => extractJson('{"broken": ,}')).toThrow(/No parsable JSON/);
  });
});
