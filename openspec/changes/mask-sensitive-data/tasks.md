## 1. The masking rules

- [ ] 1.1 Add `lib/sensitive-mask.ts` exporting `maskSensitive(text: string): { text: string; masked: { category: string; count: number }[] }`, pure, with no imports beyond the standard library, so the hook can run it without loading the app.
- [ ] 1.2 Implement the email pattern, masking `aaron@gazzola.dev` as `a****@g******.dev`: first character of the local part kept, first character of each domain label kept, the final label kept whole, every other character replaced with an asterisk one-for-one so length is preserved.
- [ ] 1.3 Implement the JSON Web Token pattern: three base64url segments separated by dots, the first decoding to an object carrying `alg`. Mask the whole token to `<jwt:masked>`.
- [ ] 1.4 Implement the prefixed-key pattern for the prefixes actually in use here and at `../eco3d.shop`: `sk-`, `sk_live_`, `sk_test_`, `sb_secret_`, `sbp_`, `ghp_`, `gho_`, `github_pat_`, `re_`, `xoxb-`, `dop_v1_`, and `eyJ` when not already matched as a token. Mask to `<key:masked>`.
- [ ] 1.5 Implement the adjacent-secret pattern: a run of 24 or more characters from the base64url alphabet appearing within 40 characters after a key-like name (`token`, `secret`, `key`, `password`, `passwd`, `authorization`, `bearer`, case-insensitive). Mask to `<secret:masked>`.
- [ ] 1.6 Implement the phone-number pattern covering international form with a leading plus and 8 to 15 digits, and grouped national forms, keeping the last two digits so two numbers stay distinguishable.
- [ ] 1.7 Implement the postal-address pattern: a street number followed by a street word (`street`, `st`, `road`, `rd`, `avenue`, `ave`, `lane`, `drive`, `court`, `place`, `parade`, `crescent`, `highway`) and the words to the end of that line. Mask the line to `<address:masked>`.
- [ ] 1.8 Return the same mask for the same input value within one call, so a value appearing twice reads as one value appearing twice.
- [ ] 1.9 Leave bare identifiers untouched, including anything that is only a hex or dash-separated identifier, so a result stays debuggable.

## 2. Proving the rules

- [ ] 2.1 Add `tests/unit/sensitive-mask.test.ts` with one payload holding a value of every category from 1.2 to 1.7, asserting each is masked and the category counts are reported.
- [ ] 2.2 Assert two different addresses produce two different masks, and the same address twice produces the same mask.
- [ ] 2.3 Assert a record identifier, a commit-like hex string and a plain sentence pass through byte-identical.
- [ ] 2.4 Assert output with nothing sensitive returns an empty `masked` array, so the caller can tell when to add a notice.
- [ ] 2.5 Add the exact address that leaked on 8-Aug-2026 as a regression case, written as a synthetic address of the same shape rather than the real one.

## 3. The hook

- [ ] 3.1 Add `.claude/hooks/mask-sensitive.mjs` reading the hook payload from standard input, applying `maskSensitive` to the tool result, and writing `hookSpecificOutput.updatedToolOutput` when anything matched.
- [ ] 3.2 Append a notice line to the rewritten output naming the number of masked values and the categories, and omit the notice entirely when nothing matched.
- [ ] 3.3 Return an empty object and exit zero when nothing matched, so an unmatched result is passed through untouched.
- [ ] 3.4 Return an empty object and exit zero on any internal error, so a fault in the hook degrades to no masking rather than breaking every tool call. Write the fault to standard error so it is visible.
- [ ] 3.5 Skip masking when `VIDSTUBE_REVEAL` is set to `1` in the hook's environment, so a value can be read deliberately for one command.
- [ ] 3.6 Import the rules from 1.1 by reading the compiled source directly rather than through the app's module resolution, so the hook does not depend on the app building.

## 4. Registering the hook

- [ ] 4.1 Create `.claude/settings.json`, which does not exist yet, registering `mask-sensitive.mjs` on `PostToolUse`.
- [ ] 4.2 Match the tools that carry production data into a session: `Bash`, `Read`, and the Supabase MCP query tool.
- [ ] 4.3 Verify the registration by running one query that returns a synthetic address and confirming the session receives it masked.

## 5. The written rule

- [ ] 5.1 Add a section to `CLAUDE.md` forbidding a sensitive value from being written into a reply, commit message, ticket or file without asking first, and naming the categories from the specification.
- [ ] 5.2 State in the same section that the hook covers what tools return and the rule covers what the session composes, so neither is mistaken for the whole safeguard.
- [ ] 5.3 Document the reveal switch, so reading a value deliberately is a known act rather than an improvised one.

## 6. The second repository

- [ ] 6.1 Create the matching change in `../eco3d.shop`, carrying `lib/sensitive-mask.ts`, its test, the hook, the settings registration and the guidance section, copied rather than shared.
- [ ] 6.2 Confirm the copied rule file is byte-identical to this repository's, so drift between the two is a single comparison.
