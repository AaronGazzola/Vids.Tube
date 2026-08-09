import { describe, expect, it } from "vitest";
// @ts-expect-error plain JavaScript, kept that way so the hook starts in tens of
// milliseconds rather than hundreds
import { maskNotice, maskSensitive } from "../../.claude/hooks/sensitive-mask.mjs";

const OWNER = "aaron@example.invalid";

describe("every covered category is masked", () => {
  it("masks an email address, keeping its shape", () => {
    const { text, masked } = maskSensitive(`owner is ${OWNER} today`);
    expect(text).toBe("owner is a****@e******.invalid today");
    expect(masked).toEqual([{ category: "email", count: 1 }]);
  });

  it("masks a JSON Web Token", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const { text, masked } = maskSensitive(`Authorization: Bearer ${jwt}`);
    expect(text).toContain("<jwt:masked>");
    expect(text).not.toContain(jwt);
    expect(masked.some((m) => m.category === "jwt")).toBe(true);
  });

  it("masks a key carrying a recognisable prefix", () => {
    const { text } = maskSensitive("key is sk_live_abcdefghijklmnop here");
    expect(text).toBe("key is <key:masked> here");
  });

  it("masks a secret sitting next to a name that calls it one", () => {
    const { text } = maskSensitive("SUPABASE_SECRET_KEY=abcdefghijklmnopqrstuvwxyz012345");
    expect(text).toContain("<secret:masked>");
    expect(text).not.toContain("abcdefghijklmnopqrstuvwxyz012345");
  });

  it("masks a phone number, keeping the last two digits", () => {
    const { text } = maskSensitive("call +61 412 345 678 now");
    expect(text).toContain("78");
    expect(text).not.toContain("412 345 678");
  });

  it("masks a postal address", () => {
    const { text } = maskSensitive("ships to 42 Wallaby Street, Sydney");
    expect(text).toBe("ships to <address:masked>");
  });

  it("masks one of every category in a single payload", () => {
    const payload = [
      `email ${OWNER}`,
      "token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop",
      "ghp_abcdefghijklmnopqrstuvwxyz",
      "password=abcdefghijklmnopqrstuvwxyz012345",
      "phone +61 412 345 678",
      "12 Baker Road, London",
    ].join("\n");
    const { masked } = maskSensitive(payload);
    const categories = masked.map((m) => m.category).sort();
    expect(categories).toEqual(["address", "email", "jwt", "key", "phone", "secret"]);
  });
});

describe("masked values stay distinguishable", () => {
  it("gives two different addresses two different masks", () => {
    const { text } = maskSensitive("a@one.invalid and bbbb@two.invalid");
    const [first, second] = text.split(" and ");
    expect(first).not.toBe(second);
  });

  it("gives the same address the same mask twice", () => {
    const { text } = maskSensitive(`${OWNER} and ${OWNER}`);
    const [first, second] = text.split(" and ");
    expect(first).toBe(second);
  });
});

describe("nothing else is touched", () => {
  it("passes a record identifier through untouched", () => {
    const row = "stream_id df26c8a7-4f67-408c-8006-9112daad3af0 ended";
    expect(maskSensitive(row).text).toBe(row);
  });

  it("does not mask an identifier even when something calls it a key", () => {
    const row = "primary key: df26c8a7-4f67-408c-8006-9112daad3af0";
    expect(maskSensitive(row).text).toBe(row);
  });

  it("passes a commit-like hex string through untouched", () => {
    const line = "commit 9f120fb2efc4a1d0b3e5a6c7d8e9f0a1b2c3d4e5 on main";
    expect(maskSensitive(line).text).toBe(line);
  });

  it("passes an ordinary sentence through byte-identical", () => {
    const line = "the broadcast ended at 15:25 with 103 messages";
    expect(maskSensitive(line).text).toBe(line);
  });

  it("reports nothing masked when nothing matched", () => {
    expect(maskSensitive("all clear").masked).toEqual([]);
    expect(maskNotice([])).toBe("");
  });
});

describe("masking announces itself", () => {
  it("names the count and the categories", () => {
    const notice = maskNotice([
      { category: "email", count: 3 },
      { category: "key", count: 1 },
    ]);
    expect(notice).toContain("4 sensitive values masked");
    expect(notice).toContain("email, key");
  });

  it("reads correctly for a single value", () => {
    expect(maskNotice([{ category: "email", count: 1 }])).toContain(
      "1 sensitive value masked"
    );
  });
});

describe("the 8-Aug-2026 regression", () => {
  // The shape of the address that reached the VOD, written synthetically.
  it("masks an owner address printed inside a query result", () => {
    const result = `[{"id":"df26c8a7","email":"${OWNER}","role":"owner"}]`;
    const { text } = maskSensitive(result);
    expect(text).not.toContain(OWNER);
    expect(text).toContain("a****@e******.invalid");
  });
});
