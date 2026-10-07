# Cached cover loading — Phase 3

Implemented October 7, 2026, starting from published Phase 2 commit `2ddf3b16c7d92f72b412b81bf0f0d10cbae194d1`. Implementation and automated checks are complete; live device/counter verification below remains pending.

## What changed

Confirmed catalog selections previously lived only in an unbounded memory map. Restarting discarded the selection even if Expo Image still had the original image on disk. Overlapping forced reads also queued repeated catalog requests. These changes address selection lookup; they do not claim that every image download or book screen is instantaneous.

- Store only catalog-confirmed public selections under the new key `novori:canonical-book-covers:v1`, including original URL, known work/edition/ISBN aliases, and catalog check timestamp. Library, route, post, provider and URL-only fallback snapshots are never promoted into durable selections.
- Share one asynchronous storage read on a cold start. Fresh restored selections need no cover catalog read. Stale confirmed originals return immediately after that local read and remain visible during the existing catalog recheck. Explicit refreshes still wait for the requested catalog result.
- Retain the existing **60-second** catalog freshness window. The new disk cache retains confirmed entries for up to **14 days**, stores at most **1,000 aliases**, and caps its JSON record at **512,000 characters** (at most 1.54 MB UTF-8). Count/size/age eviction removes old entries; it does not wipe existing metadata caches or Expo Image's image files.
- Limit memory to **1,000 idle aliases plus mounted image keys**. Mounted `BookCoverImage` subscriptions pin their keys; unmounting releases pins and trims the cache. Recent snapshot reads retain their entries during ordinary eviction.
- Reject corrupt, unsupported, expired, future-dated, unconfirmed or invalid stored rows. Device storage failures fall back to the live catalog path. Coalesce writes and serialize them so a slow older write cannot overwrite a newer choice. Delayed hydration cannot replace a live catalog winner, including through another alias of the same work.
- Coalesce forced refreshes by book key. Upgrade an ordinary batch that has not been sent yet. If an ordinary request has already started, allow one shared follow-up for a promotion that may have completed afterward. Callers joining an active forced request share that request.

The shared catalog remains authoritative: only its responses replace an established choice, and a confirmed update propagates to all known aliases. Rendering still uses the original selected URL at every display size, with Expo Image `memory-disk`, zero transition, and no image-error artwork substitution. No new metadata provider calls, image prefetches, cache clears or backend changes were added. Existing metadata/provider cache keys, TTLs, selector ranking, manual locks, quotas, and library/reader data boundaries are unchanged.

## Verification

- **81 suites / 887 tests pass**, including **23 cover-focused tests**. Existing metadata/provider cache, selector, discovery, publication, series and shared cover endpoint checks also pass.
- App and typed-test TypeScript checks pass. iOS and Android production JavaScript/Hermes exports pass. These are not signed native builds.
- Public website **17 tests pass** and **729 license notices verify**. Dependencies and notice data were not changed in Phase 3.
- Simulated restart restores original edition/ISBN aliases with **zero catalog invocations** while the 60-second window is fresh. Stale selections return before a deferred network result; offline rechecks retain confirmed originals.
- Tests cover mounted image eviction safety, serialized writes, hydration races, malformed rows, large URL storage size, failed image behavior, missing selections, and promotion propagation.

An isolated source comparison against the previous commit used the same mocked catalog with a 10 ms artificial delay; it made no real provider requests:

| Scenario | Before | After |
| --- | --- | --- |
| 20 simultaneous forced refreshes for one book | 20 catalog reads | 1 catalog read |
| Fresh confirmed selection after simulated restart | Selection lost; catalog read required | 0 catalog reads; same original URL |
| Forced callers before an ordinary batch is sent | Queued redundant follow-ups | 1 upgraded catalog read |
| 20 forced callers after an ordinary read started | Repeated follow-ups | 2 total reads: original plus one shared follow-up |

This measures controlled request counts, not real device latency or deployed provider counters. The cover endpoint reads existing catalog candidates without requesting ISBNdb, Hardcover or Google metadata. Fetching an image file when Expo Image has evicted it is separate from those provider API counters.

## Device and deployed counter checks — pending

1. Pull the update and reload the existing development client. Phase 3 changes only JavaScript and tests, so it requires no additional native dependency rebuild. Do not uninstall or clear app storage: doing so removes the caches this test needs.
2. On a real iPhone and iPad, open several already cached books, including a locked/manual cover and a high-resolution favorite. Compare Discover, detail, Library, Profile and a stack that already contains the book. Original artwork must match across surfaces; display sizes stay as previously configured.
3. After normal loading, allow at least one second for the coalesced persistence write, then force-quit and reopen. Repeat within 60 seconds: confirmed selections should restore without a cover catalog call. Repeat after 60 seconds: the saved original should remain visible while the background recheck runs. The first install of Phase 3 must obtain confirmed choices before it has anything to restore.
4. Repeat the restart in airplane mode for books whose image files have already loaded. Confirmed selections must remain stable. An OS-evicted image file cannot be downloaded while offline; do not interpret that as a missing selection or try to replace the artwork with another provider's image.
5. Open/back/open the same cached book rapidly and expand its series. Confirm no change in artwork, no blanking during ordinary cache churn, and that a completed promotion updates the visible cover rather than retaining a superseded selection.
6. Run the existing read-only `admin/verify-api-usage.sql` immediately before and after controlled cached-book actions, without unrelated testers/actions and within the same UTC day. Compare ISBNdb/Hardcover/Google deltas and the admin refresh timestamp. Expect no upstream increase for fresh fully cached reads; distinguish legitimate missing/expired metadata enrichment from cover selection rechecks. Record actual counters and `[Novori book opening]` timings rather than inferring them from automated checks.

No live account/backend credentials or physical devices were used for this validation. Native/offline image behavior and deployed counter evidence remain device checks. Phase 2's open dependency dispositions and pre-existing app-web static-export error remain recorded separately; Phase 3 does not close them.

## Discovery response ordering follow-up

Cover and search-catalog reads capture a session revision. Responses started before a newer confirmed selection cannot overwrite it through the same ID or a newly learned work alias. Later reads can still publish genuine catalog changes. Revisions are not written to device storage; the existing v1 records remain compatible. Discovery cards now use verified catalog IDs and otherwise retain their listing artwork without unverified ISBN cover queries. See [discovery follow-up](DISCOVERY_BOOK_OPENING.md) for matching, missing-detail behavior and device acceptance limits.
