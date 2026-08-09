> **Deviation recorded during implementation.** The rules were written as plain
> JavaScript at `.claude/hooks/sensitive-mask.mjs` rather than as
> `lib/sensitive-mask.ts`, and task 3.6 was dropped as a result. The hook runs on
> every tool result, and a TypeScript loader costs hundreds of milliseconds of
> startup per tool call against tens for plain Node. Measured at about 57ms per
> call as built. Nothing in the application imports these rules, so the file has
> no reason to live under `lib/`.

## 1. The masking rules

- [x] 1.1 Add `.claude/hooks/sensitive-mask.mjs` exporting `maskSensitive(text)` returning `{ text, masked: [{ category, count }] }`, pure, with no imports beyond the standard library, so the hook can run it without loading the app.
- [x] 1.2 Implement the email pattern, masking `aaron@gazzola.dev` as `a****@g******.dev`: first character of the local part kept, first character of each domain label kept, the final label kept whole, every other character replaced with an asterisk one-for-one so length is preserved.
- [x] 1.3 Implement the JSON Web Token pattern: three base64url segments separated by dots, the first decoding to an object carrying `alg`. Mask the whole token to `<jwt:masked>`.
- [x] 1.4 Implement the prefixed-key pattern for the prefixes actually in use here and at `../eco3d.shop`: `sk-`, `sk_live_`, `sk_test_`, `sb_secret_`, `sbp_`, `ghp_`, `gho_`, `github_pat_`, `re_`, `xoxb-`, `dop_v1_`, and `eyJ` when not already matched as a token. Mask to `<key:masked>`.
- [x] 1.5 Implement the adjacent-secret pattern: a run of 24 or more characters from the base64url alphabet appearing within 40 characters after a key-like name (`token`, `secret`, `key`, `password`, `passwd`, `authorization`, `bearer`, case-insensitive). Mask to `<secret:masked>`.
- [x] 1.6 Implement the phone-number pattern covering international form with a leading plus and 8 to 15 digits, and grouped national forms, keeping the last two digits so two numbers stay distinguishable.
- [x] 1.7 Implement the postal-address pattern: a street number followed by a street word (`street`, `st`, `road`, `rd`, `avenue`, `ave`, `lane`, `drive`, `court`, `place`, `parade`, `crescent`, `highway`) and the words to the end of that line. Mask the line to `<address:masked>`.
- [x] 1.8 Return the same mask for the same input value within one call, so a value appearing twice reads as one value appearing twice.
- [x] 1.9 Leave bare identifiers untouched, including anything that is only a hex or dash-separated identifier, so a result stays debuggable.

## 2. Proving the rules

- [x] 2.1 Add `tests/unit/sensitive-mask.test.ts` with one payload holding a value of every category from 1.2 to 1.7, asserting each is masked and the category counts are reported.
- [x] 2.2 Assert two different addresses produce two different masks, and the same address twice produces the same mask.
- [x] 2.3 Assert a record identifier, a commit-like hex string and a plain sentence pass through byte-identical.
- [x] 2.4 Assert output with nothing sensitive returns an empty `masked` array, so the caller can tell when to add a notice.
- [x] 2.5 Add the exact address that leaked on 8-Aug-2026 as a regression case, written as a synthetic address of the same shape rather than the real one.

## 3. The hook

- [x] 3.1 Add `.claude/hooks/mask-sensitive.mjs` reading the hook payload from standard input, applying `maskSensitive` to the tool result, and writing `hookSpecificOutput.updatedToolOutput` when anything matched.
- [x] 3.2 Append a notice line to the rewritten output naming the number of masked values and the categories, and omit the notice entirely when nothing matched.
- [x] 3.3 Return an empty object and exit zero when nothing matched, so an unmatched result is passed through untouched.
- [x] 3.4 Return an empty object and exit zero on any internal error, so a fault in the hook degrades to no masking rather than breaking every tool call. Write the fault to standard error so it is visible.
- [x] 3.5 Skip masking when `VIDSTUBE_REVEAL` is set to `1` in the hook's environment, so a value can be read deliberately for one command.
- [x] 3.6 Dropped: the rules are plain JavaScript in the same folder, so there is nothing to import across a build boundary. See the deviation note above.

## 4. Registering the hook

- [x] 4.1 Create `.claude/settings.json`, which does not exist yet, registering `mask-sensitive.mjs` on `PostToolUse`.
- [x] 4.2 Match the tools that carry production data into a session: `Bash`, `Read`, and the Supabase MCP query tool.
- [x] 4.3 Verify the hook end to end by feeding it the payload shape Claude Code sends, confirming a synthetic address and a prefixed key come back masked with a two-category notice, that the reveal switch passes the same payload through, and that a malformed payload degrades to no masking. Verified against the hook itself; the registration loads at session start, so the first session started after this change is the one that exercises it in place.

## 5. The written rule

- [x] 5.1 Add a section to `CLAUDE.md` forbidding a sensitive value from being written into a reply, commit message, ticket or file without asking first, and naming the categories from the specification.
- [x] 5.2 State in the same section that the hook covers what tools return and the rule covers what the session composes, so neither is mistaken for the whole safeguard.
- [x] 5.3 Document the reveal switch, so reading a value deliberately is a known act rather than an improvised one.

## 6. The second repository

- [x] 6.1 Create the matching change in `../eco3d.shop`, carrying the two hook files, the settings registration and the guidance section, copied rather than shared. Archived there as `2026-08-09-mask-sensitive-data`. The test stays here, since that repository has no test runner and identical files cannot behave differently.
- [x] 6.2 Confirm the copied rule file is byte-identical to this repository's, so drift between the two is a single comparison.
