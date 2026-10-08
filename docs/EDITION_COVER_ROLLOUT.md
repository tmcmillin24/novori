# Edition artwork and validated discovery rollout

The October 7 live export contained 2,266 audit rows, including 1,517 version-1 insufficient-quality selections. All four explicitly requested ISBN covers were already cached. A selected URL was also present for Catching Fire. Those records established that missing selection rows were not the sole failure: the app also coupled different editions through a shared work-level cover winner.

## Behavior

- The cover endpoint reads edition metadata and preserves each edition's artwork. It no longer reruns the historical work-level selector on reads. Matching title, author and English language are required before another edition can supply an alternative. Locked manual selections still win. Saved book IDs and rating identities are unchanged.
- Threshing Day 9781682818527, Philosopher's Stone 9781781100219, Piranesi 9781432895082 and Scion 9781668239261 retain explicit owner preferences using cached records.
- All BookCoverImage consumers share an edition-scoped store and advance together on an image error to a verified alternative. Confirmed alternatives and short-lived failure information survive restart. Manual artwork does not switch on a transient network error.
- Edition page counts, descriptions, publishers, dates and ISBNs stay together; shared work title/series identity enrichment no longer overwrites those fields.
- ISBNdb detail misses retain usable catalog metadata, including legacy records without an ISBN. Complete stored details need no upstream lookup.
- Discover publishes catalog cards with a matching edition ID and cover URL immediately, including cards from older server deployments. Image sizing or prefetch failure no longer suppresses the feed. Actual image errors use the shared BookCoverImage verified alternatives. Short feeds publish ready cards immediately, then fill toward twenty eligible primary authors through the existing cached/quota-controlled resolver. At most two lookups run at once and forty missing candidates are attempted per feed refresh; these are resolver calls, not a guarantee of forty upstream requests. Stored resolved cards and a five-minute local fill cache avoid repeat lookups. Full eligible feeds make no missing-book requests. The selected image's edition ID remains the route ID.
- The last validated feed is retained for up to seven days during refresh/failure. Unusable candidates do not become empty cards. Feed length depends on available catalog records. Hardcover work release dates, rather than an arbitrary edition's printing date, remain the Recent Releases date source.
- Discover search initially exposes ten ranked, deduplicated results and reveals ten more on scroll. Existing provider pages remain 40 records for ranking/cache compatibility; another page is requested only after local results are exhausted. Popularity still comes from the existing shared Hardcover cache.

## Cache and rollout

Only the device's derived cover namespace changes from v1 to v2. Raw provider caches, image caches, quota limits, refresh leases, libraries, reviews, ratings and database records are not wiped. New Discover overlays run over existing cached Hardcover responses; there is no blanket provider-cache invalidation or SQL migration.

Run from Terminal in the repo:

```sh
git pull origin phase5-ask-readers
bash scripts/deploy-catalog-repair.sh
npx expo start --dev-client --port 8082
```

The deploy script uses the saved Supabase CLI authentication / SUPABASE_ACCESS_TOKEN and explicit project ref. It does not require `supabase link` or a database password. Deploy server functions before launching the updated client. If deploying fails, stop and resolve that failure rather than testing mismatched client/server versions.

## Verification and remaining limits

TypeScript checks pass. The full test run passes 94 suites / 993 tests. Automated coverage includes production-export fixtures for 23 work records; exact requested ISBNs; differing edition artwork; unrelated-author/foreign/supplement rejection; manual locks; candidate-less metadata; endpoint authentication/limits; cross-screen image fallback; cache restarts and late response races; validated feed fallback; and pagination without duplicate or stale-query contamination.

This environment's direct requests to six ISBNdb cover URLs received Cloudflare HTTP 403 / code 1010. That does not establish that the same URLs fail on the device, and the artwork could not be visually certified here. Catalog matching cannot certify every image is a flat, visually correct cover. Native iPhone/iPad verification remains required after function deployment: search, open, save, return, restart, and test offline with a previously loaded book/feed. Test the reported titles plus unrelated popular titles. Confirm API usage remains stable on repeated cached reads.

The old catalog-cover-health SQL reports historical work selection state; it is no longer a complete measure of displayed cover availability under this edition policy.

## Saves ranking and empty-feed correction

Search uses Hardcover `users_count` (users who added the book to their library) as its primary popularity signal, ahead of rating/review counts. It is not a separate Novori save count or a verified want-to-read-only count. Original prose novels precede graphic adaptations unless the query explicitly asks for graphic/comic/manga results. Adaptations retain separate work identities, ISBNs and covers; provider matching requires equal normalized titles instead of prefix equivalence. Derived popularity keys advance to book/work v4 and batch v5 to avoid reusing misattributed counts; raw provider and cover caches are retained.

Trending continues to use Hardcover's trending feed; Recent Releases uses its release-date eligibility and library-count ordering. These feeds are not replaced with an all-time-save ranking. Deployment of `hardcover-search-popularity` and a client reload are required for this correction. Live device rendering remains a separate acceptance check.

The correction passes the complete 94-suite / 999-test run and TypeScript checks. A further focused regression verifies that ready catalog cards bypass unresolved neighbors without identity requests.

## Twenty-book feed refill

Both rows display at most twenty books with one book per normalized primary author. Trending draws from the full prepared provider pool instead of cutting to forty entries before author diversification. Recent Releases retains its release-date eligibility and genre-first selection, excludes the twenty global Trending picks and the reader's library, then fills to twenty. Its provider fetch runs alongside Trending, but missing-book fill waits for Trending's final selection so overlap removal cannot unexpectedly shrink a completed row. Provider errors, missing identities, unavailable covers or quota exhaustion may still leave fewer than twenty genuine eligible books; no filler or unverified artwork is inserted.

Newly resolved cards are published progressively and persisted. Stale/unmounted fills stop without publishing late results. A full row makes no identity requests; unresolved candidates are skipped for already represented authors and ineligible library/Trending overlap. Standard editions retain their existing shared work/review identity, while adaptations remain separate. Search and author lists use saves/library adds, then Hardcover review count; search ties use relevance and stable IDs. Star averages no longer break these search popularity ties.

Refill validation: TypeScript passes, and the complete suite passes 95 suites / 1,008 tests. Regression coverage includes two/five cached cards filling to twenty, immediate progress, restart reuse without identity/cover requests, excluded/repeated authors, two-request concurrency, forty-attempt failures, stale-fill cancellation, author-name variants and save/review/relevance ordering.

## Current policy — verified Hardcover discovery art (2026-10-08)

Manual locks remain authoritative. For books represented in Trending/Recent Releases, the verified English Hardcover default cover edition takes precedence over automatic ISBNdb artwork; an English, released, non-audio edition is required. A primary foreign/audio image is never accepted merely because the work has an English title. Unknown, audiobook-only, upcoming-text-only, compilation and supplementary products are excluded from new feeds. Discovery search excludes known audio editions.

Server-generated cover proofs are retained in the existing raw discovery cache. On catalog cover reads, title/author/language verification attaches those proofs to catalog identities (including identities created after the feed fetch) and persists a Hardcover candidate in the existing cover-candidate table. No provider request is made by this operation, and identical candidates are not rewritten. The common cover reader returns the same work cover, safe catalog edition aliases, genres and available review counts to every cover consumer. Older saved feed/ISBNdb responses cannot downgrade a confirmed Hardcover choice. Actual image failures retain shared verified alternatives. ISBNdb remains the metadata and fallback-art provider; IDs, ISBNs, publication/page data and reader reviews are not replaced by cover promotion.

Trending still displays twenty distinct-author books at a time. It prepares a pool of up to fifty eligible authors for genre filters; Recent Releases remains twenty. Missing-book fill is bounded to two concurrent resolutions and at most one hundred candidates for Trending / forty for Recent Releases. These are resolver attempts, not an upstream request guarantee. Warm resolved pools reuse stored cards. Unknown genre subject headings are omitted, recognized genres are normalized, and verified Hardcover genres take priority when available. LitRPG/progression filtering is supported. Search cards display actual available Hardcover review counts, including zero, without treating rating counts as reviews or making a separate count lookup.

Only derived feed versions change: server Trending v7, Recent Releases v4 and device feed v8. Changed Hardcover queries need their normal first cached refresh to obtain format/default-edition proof; raw provider, cover and reader caches are not cleared. There is no new table or migration. Deploy all helper consumers using the existing deploy script with the saved access token, then reload the client. This workspace cannot deploy to live Supabase or certify physical-device imagery.
