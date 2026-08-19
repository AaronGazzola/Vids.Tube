## REMOVED Requirements

### Requirement: Leaderboard entries expose the AI's scoring reasoning

**Reason**: The surface no longer exists. The `/studio/control` route was removed when stream
operations were folded into the `/live` page, and the per-chatter reasoning was not rebuilt on the
Activity tab, so the requirement has described absent behaviour since that fold.

**Migration**: None for users, the behaviour having already been unreachable. The reasoning read and
its hook are deliberately retained, unreferenced, for a chatter detail page in the studio; that page
will restate the requirement against the surface it actually has.
