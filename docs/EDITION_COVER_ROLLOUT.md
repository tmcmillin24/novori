# Edition artwork and validated discovery rollout

The October 7 live export contained 2,266 audit rows, including 1,517 version-1 insufficient-quality selections. All four explicitly requested ISBN covers were already cached. A selected URL was also present for Catching Fire. Those records established that missing selection rows were not the sole failure: the app also coupled different editions through a shared work-level cover winner.

## Behavior

- The cover endpoint reads edition metadata and preserves each edition's artwork. It no longer reruns the historical work-level selector on reads. Matching title, author and English language are required before another edition can supply an alternative. Locked manual selections still win. Saved book IDs and rating identities are unchanged.
- Threshing Day 9781682818527, Philosopher's Stone 9781781100219, Piranesi 9781432895082 and Scion 9781668239261 retain explicit owner preferences using cached records.
- All BookCoverImage consumers share an edition-scoped store and advance together on an image error to a verified alternative. Confirmed alternatives and short-lived failure information survive restart. Manual artwork does not switch on a transient network error.
- Edition page counts, descriptions, publishers, dates and ISBNs stay together; shared work title/series identity enrichment no longer overwrites those fields.
- ISBNdb detail misses retain usable catalog metadata, including legacy records without an ISBN. Complete stored details need no upstream lookup.
- Discover validates image loading, minimum dimensions and portrait aspect ratio before publishing cards. The selected image's edition ID is also the route ID. At most four images are checked concurrently; up to six missing catalog identities per feed refresh may use the existing cached/quota-controlled resolver. This is a lookup count, not a promise of six upstream requests (the resolver may perform several cached lookups).
- The last validated feed is retained for up to seven days during refresh/failure. Unusable candidates do not become empty cards. Feed length depends on available validated records. Hardcover work release dates, rather than an arbitrary edition's printing date, remain the Recent Releases date source.
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

This environment's direct requests to six ISBNdb cover URLs received Cloudflare HTTP 403 / code 1010. That does not establish that the same URLs fail on the device, and the artwork could not be visually certified here. Image dimensions/loading checks do not detect every angled photo or visually incorrect cover. Native iPhone/iPad verification remains required after function deployment: search, open, save, return, restart, and test offline with a previously loaded book/feed. Test the reported titles plus unrelated popular titles. Confirm API usage remains stable on repeated cached reads.

The old catalog-cover-health SQL reports historical work selection state; it is no longer a complete measure of displayed cover availability under this edition policy.
