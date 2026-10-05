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
