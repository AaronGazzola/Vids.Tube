## Context

Recordings carry a `status` describing how far processing got: `ready` or
`failed`. Nothing describes who may see one. Hiding the 8-Aug-2026 broadcast was
done by writing `failed` onto a recording that processed perfectly, because that
was the only field that removed it from the site.

That overload is the problem. The reaper and the studio both read `status` to
decide whether a recording needs attention, and a deliberately hidden recording
now looks to both of them like a broken one.

## Goals / Non-Goals

**Goals:**
- Separate "how did processing go" from "who may see this".
- Make private mean private against a direct request, not merely absent from a
  list.
- Change nothing a viewer currently sees.

**Non-Goals:**
- Per-person sharing, link expiry, or membership-gated recordings. Three states,
  matching YouTube, and nothing more.
- Protecting the file in storage behind signed URLs. See the risk below, which
  is accepted deliberately.
- Editing recordings. That is AZ-190.

## Decisions

**Three states, named as YouTube names them.** The owner already reasons in
YouTube's vocabulary and publishes to both places. Inventing a fourth state, or
different words for the same three, would cost more than it buys.

**Visibility is a separate column, not a value of `status`.** Adding `hidden` to
`status` would repeat the mistake being fixed: the two questions are
independent, and a recording can be private and ready, or public and still
processing.

**Enforced in the read policy.** A page-level check leaves the row readable to
anything that queries the table directly, which includes the site's own client.
Putting it in the policy makes the rule true for every reader.

**Private answers not-found, never forbidden.** Forbidden confirms the recording
exists. For a recording withheld because of what is in it, that confirmation is
itself a disclosure.

**Unlisted is reachable by address, and that is the whole point.** It is the
state for something published to people who have the link, and it is what makes
a replacement recording checkable before it goes public.

**Everything existing becomes public on migration, with one exception.** Any
other default would hide recordings that are currently visible. The 8-Aug-2026
recording is the exception, and is also the row whose `status` is corrected.

## Risks / Trade-offs

- **The file in storage stays reachable by its URL, so a private recording is
  private in the catalogue but not in the bucket** → Accepted for this change,
  and stated plainly rather than implied. Addresses are long and unguessable,
  and the leak this responds to is about discovery through the site. Signed
  URLs are a larger change and belong with the editing work, which will need
  them anyway.
- **A private recording stops appearing in the studio's own lists if the policy
  is written carelessly** → The owner's own reads must be exempt, and that is a
  scenario in the specification rather than a note here.
- **Chat replay and the timeline read recordings too** → Every reader of the
  table inherits the policy, which is the intent, but each surface needs
  checking rather than assuming.

## Migration Plan

- Add the column defaulting to `public`, backfill every existing row to
  `public`, then set the 8-Aug-2026 recording to `private` and its status back
  to `ready` in the same migration.
- Rollback is dropping the column and restoring the previous read policy. No
  data is destroyed.

## Open Questions

None.
