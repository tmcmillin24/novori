# API and cache audit — October 5, 2026

The supplied live snapshots were Hardcover 177 today versus Novori 144, and ISBNdb 81 today. This source/test audit cannot read the production database or signed-in provider dashboards. The 33-request difference is not attributed to a specific cause or added to any counter without evidence.

## Routes and accounting

| App operation | Active route with NOVORI_BOOK_PROVIDER=isbndb | Accounting |
| --- | --- | --- |
| Search and author searches | google-books-search compatibility endpoint → ISBNdb | Atomic novori_claim_isbndb_request before network |
| ISBN/barcode and title identity resolution | google-books-resolve → ISBNdb | Same shared ISBNdb cache and counter |
| Book details, including old Google IDs | google-books-detail → ISBNdb or existing catalog | Same shared ISBNdb cache and counter |
| Series identity/language fallback | cachedGoogleQuery → ISBNdb | Google quota callback is not called |
| Series metadata | hardcover-series → cachedHardcoverFetch | novori_record_hardcover_request before network |
| Ratings/popularity | hardcover-search-popularity → cachedHardcoverFetch | Same Hardcover counter |
| Trending | hardcover-trending → fetchHardcoverUpstream | Same Hardcover counter |
| Recent releases | hardcover-recent-releases → fetchHardcoverUpstream | Same Hardcover counter |
| Cover selection and publication facts | Catalog/database only | No upstream provider calls |

All current Hardcover network calls pass the tracked boundary. Existing direct fetches in Trending/Recent Releases read and write Supabase's Discover cache, not Hardcover. There is no raw native fetch to the Google Books API: Google-shaped URLs are parsed by the compatibility proxy. The shared JSON fetch boundary now rejects Google Books API URLs in ISBNdb mode as additional protection. Existing Google-hosted image URLs and cached Google metadata remain available; downloading an existing cover is separate from a Books metadata/search API request.

ISBNdb and Hardcover counters reserve an attempt immediately before sending. Failed HTTP/network attempts count. Cached reads, concurrent requests joining an existing refresh, denied ISBNdb quota claims, and Hardcover cooldown-blocked requests do not count. An interrupted process may reserve an attempt that never reaches the provider. Provider websites can include other key usage or older deployments; their day boundary must be checked separately. Admin counts are recorded Novori attempts, not an automatically synchronized provider bill.

ISBNdb UI and backend support existed before this audit; their absence from the live admin suggests an older deployment, but the deployed version must be verified. The admin now reports its audit version, configured provider, ISBNdb key presence, UTC day window, and refreshed-at timestamp. Key values are never exposed. It reads ISBNdb from novori_isbndb_usage_daily, Hardcover from novori_api_usage_daily, and historical Google quota counts from api_usage_daily. Derived publication records and retry controls are labeled in the cache sample so cache entries are not mistaken for provider calls.

## Cache controls retained

- ISBNdb search: seven days fresh, fourteen days stale; details: thirty days fresh, sixty days stale. Existing keys and caches are preserved.
- Hardcover series: fourteen days fresh, ninety days stale. Popularity has per-book/work/batch reuse; source expiration caps derived freshness. Discover caches remain unchanged.
- Refresh leases coalesce concurrent cold requests. Failed lookups have retry cooldowns and existing usable stale data remains available. A cache/lock outage does not fall through to an unclaimed provider request.
- ISBNdb keeps global 1.1-second spacing, a 4,500-request daily safety limit, and existing reader limits. Hardcover 429 responses trigger a shared cooldown across query keys.
- Local search/detail reuse, shared cover selection, manual cover locks, and reader-specific data boundaries are unchanged.

## Production verification

1. Redeploy novori-admin and all seven provider-facing functions. Cloudflare Pages must build the latest production branch. Confirm the admin audit version and ISBNdb provider/key status.
2. Run admin/verify-api-usage.sql and refresh API & cache at the same time. The portal must match the database today/7-day/30-day values; do not expect invented backfilled provider totals.
3. Record the two provider website daily totals and database counters. Repeat a warm search and open the same cached book; upstream counters should remain unchanged when all needed records are warm.
4. Search one previously unseen title. A cold search can perform several legitimate requests, including author refinement or series identity work. Compare each provider's delta with the database delta, rather than assuming one app action equals one request. New Hardcover logs identify the route; ISBNdb logs identify search versus detail without keys or query text.
5. Google’s Novori quota counter must not increase in ISBNdb mode. Check search, barcode, detail, series, Trending and Recent Releases. If it increases, inspect the configuration/deployed versions and the provider logs before any further fallback changes.
6. If the 33-request historical gap persists but both totals increase by the same amount, tracking is aligned going forward; historical attribution still requires older deployment logs or provider records. If the gap grows, capture the same-time snapshots and route logs to identify the untracked source.

Regression coverage includes all four Hardcover route boundaries; ISBNdb proxy/search/barcode/detail reuse; a direct Google-request block; series fallback without Google quota; single-count Hardcover misses; warm-cache reuse; failures/cooldowns; and admin ISBNdb totals, status, UTC windows and cache-kind labels. Live deployment validation remains a separate step.

## Follow-up audit — October 8, 2026

Scope: current app search/detail/author/series/barcode readers, persisted discovery pools, canonical artwork, shared provider cache, refresh leases, quota boundaries and deployed-verification requirements. This is source and automated-test evidence; production credentials and device/provider counters were unavailable. No runtime cache settings, records or provider code were changed.

### Current configuration

| Layer | Fresh / retention | Behavior |
| --- | --- | --- |
| ISBNdb search | 7 days fresh / 14 days stale, plus positive TTL jitter | Shared page/query cache; refresh lease 60 seconds |
| ISBNdb ISBN details | 30 days fresh / 60 days stale, plus jitter | Barcode and edition detail share ISBN cache |
| Hardcover series | 14 days fresh / 90 days stale, plus jitter | Shared membership; derived source-expiration cap; 600-second outer lease |
| Hardcover popularity | 1 day fresh / 3 days stale, plus jitter | Work/book/batch and GraphQL reuse; source-expiration cap |
| Trending / Recent Releases | 6 hours fresh / 3 days stale fallback | Raw discovery cache plus refresh lock; separate current policy keys |
| Completed app search | 5 minutes / 40 entries | Concurrent calls coalesce; returned data is copied |
| Raw app search | 10 minutes in memory | Query and pagination keys distinct |
| Device detail metadata | 30 days / 150 persisted books | Original saved timestamp retained on reads; serialized index writes |
| Device discovery pool | 7 days from local save / 100 cards | Cached-first display; fills bounded to two concurrent resolutions |
| Canonical cover selection | 60-second recheck / 1,000 idle entries, 512,000 storage characters | Confirmed selection returns immediately; catalog recheck in background |
| Image files | Expo Image memory-disk | Separate from metadata/provider cache; OS eviction remains possible |

Fresh cached provider reads bypass upstream quota reservation. ISBNdb reserves attempts atomically, with global 1.1-second spacing, 4,500/day safety limit and 250/day reader limit. Hardcover attempts are recorded before sending; 429 cooldown applies across keys. Cache/lock failures do not permit an unclaimed upstream request. Failed refreshes preserve original stale deadlines. Positive artwork survives restart and late responses cannot downgrade newer canonical selections. Manual locks retain priority; Hardcover image-load failures retain the chosen cover rather than silently selecting ISBNdb artwork. Shared cover catalog reads do not consume metadata-provider calls.

### Findings to review

1. **ISBNdb negative detail retention is long.** `lookup` writes both successful books and confirmed null/404 results with the same 30-day freshness and 60-day stale window. Newly available catalog data can stay hidden much longer than intended. Consider a separate short negative TTL while preserving positive entries and quota cooldowns.
2. **Complete catalog detail rows bypass provider freshness.** `isbnDbDetail` returns any `detail_complete` edition immediately and does not inspect its age. This gives excellent warm-book availability, but provider metadata corrections are not guaranteed to refresh after the advertised 30-day TTL. Keep existing details available while specifying an explicit age-based revalidation policy. The device catalog fast path separately accepts complete rows up to 90 days and may persist them for another 30 days; provider-source age is not carried through that local saved timestamp.
3. **Incomplete ratings enrichment is cached as a completed search.** The client deliberately swallows popularity lookup failures and returns usable books; the complete result is then reused for five minutes. No-match popularity records also retain a one-day TTL. This matches the user's accepted policy of hiding unavailable counts, but it must not be described as a guaranteed successful metadata lookup. Independent status-aware retry would be a future improvement, not a reason to clear book or cover caches.
4. **Device discovery age measures local writes, not provider age.** `prepareDiscovery.emit` stores `savedAt: Date.now()` even when re-emitting the saved pool. Repeated fallback use can renew the local seven-day window. Server stale fallback remains bounded to three days. Persisting the provider/original source timestamp would make the local age limit strict while still allowing explicit offline fallback.
5. **Not all raw memory maps have capacity bounds.** `volumeMemoryCache` has expiry checks but no deletion/cap. `memoryCache` trims only the fresh-provider response branch; persistent/catalog hit insertions and failure entries can bypass that trim. Expired entries remain resident. This creates potential memory growth in long sessions; it is not evidence of extra upstream requests or cover corruption. A shared bounded insertion policy would close this gap.

The full current suite passes **97 suites / 1,043 tests**. Relevant regressions exercise concurrent refresh coalescing, fresh reuse without provider calls, stale fallback/cooldown, GraphQL error rejection, source-expiration caps, ISBNdb/Google separation and quota failure, restart persistence, cover hydration/order, alias propagation, offline retention and shared entry-point reuse. These passing tests do not invalidate the source findings above; they do not cover every identified policy gap.

Production verification remains the read-only same-time counter procedure above. Confirm deployed functions/configuration and warm ISBNdb/Hardcover counter deltas before calling this audit a production sign-off. No cache wipe is recommended.

## Implemented follow-up — October 8, 2026

- ISBNdb confirmed missing ISBNs now have a six-hour negative window; successful books retain thirty-day freshness and sixty-day stale availability. Existing negative rows are capped on read, without deleting positive/provider/image caches or changing keys. Partial/no-match Hardcover popularity batches and negative per-book metadata use a six-hour derived window; underlying GraphQL source caches retain their existing policy.
- Complete edition details inspect the catalog's original fetched timestamp. Fresh complete rows still avoid provider requests; older rows enter the existing shared ISBN lookup with refresh locks/quota controls and retain old usable details on failure. Automatic ISBN metadata refresh preserves existing complete, identity-matching edition imageLinks before catalog ingestion. Hardcover/manual cover selection, aliases and canonical image-error policy are unchanged.
- Device catalog-detail reads use the thirty-day source window and persist the original fetched timestamp rather than starting another thirty days. Already valid persisted detail rows remain compatible and are not cleared.
- Failed/invalid ratings enrichment is returned as usable books with available metadata but is not remembered as a completed local search. Raw search/catalog caches remain reusable; server failure cooldowns continue protecting upstream requests. Confirmed absence remains a negative cache rather than an error.
- Discovery persistence records the provider response timestamp. The server now reports its shared-cache fetched timestamp, including shared stale responses; publishing an existing saved fallback without newly prepared cards does not rewrite its saved timestamp. Malformed/future local timestamps are rejected. Cached covers are still published immediately and resolution budgets are unchanged.
- Both raw metadata memory maps prune expired entries and cap every insertion path at 300 entries, including device/catalog hits and errors. Eviction does not clear persisted details or canonical cover selections.

Regression coverage adds seven checks for negative TTL and legacy negatives, source-age persistence, fresh zero-provider details, stale metadata retaining original artwork, outage fallback, memory capacity, incomplete-rating retry and non-renewing discovery fallback. The full suite passes **97 suites / 1,050 tests**; TypeScript passes. iOS and Android production exports also pass. Actual device/provider counters remain deployment acceptance checks.

Deploy every consumer of the shared helpers with `bash scripts/deploy-catalog-repair.sh` after pulling and authenticating the CLI. No database migration, cache wipe, image prefetch or native dependency update is required. Warm provider metadata keeps the existing zero-upstream path; missing/expired metadata can legitimately refresh within quota/backoff limits.
