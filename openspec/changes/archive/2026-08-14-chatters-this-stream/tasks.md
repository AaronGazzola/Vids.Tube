## 1. The count

- [x] 1.1 Add a migration creating `stream_unique_chatters(uuid)`, counting distinct participants
      in one broadcast's chat, and revoke execute from PUBLIC as well as anon and authenticated,
      since revoking the roles alone leaves the inherited grant in place.
- [x] 1.2 Push the migration and regenerate `supabase/types.ts`.
- [x] 1.3 Call it from `getBannerCountsAction` for the live stream, returning null off air.

## 2. The kind

- [x] 2.1 Rename `totalChatters` to `chattersThisStream` with the label "Unique chatters this
      stream", so a saved message carrying the old kind degrades rather than changing meaning.
- [x] 2.2 Map it in `lib/banner-metrics.ts` and at every call site.

## 3. Prove it

- [x] 3.1 Update the metric fixtures and assertions across the unit tests.
- [x] 3.2 Run the banner and settings browser specs.

## 4. Land it

- [x] 4.1 Run `openspec validate --strict` and archive.
