# Shared book loading

All book entry points use `src/app/book/[id]/index.tsx`, including profile books, feed/profile post attachments, stacks, Discover results, Trending, Recent Releases, library, and club books. Metadata uses the shared `fetchGoogleBooksJson` memory/persistent/catalog/server cache path. The page resolves the existing canonical cover, displays the book, and loads optional series information separately for every source.

`searchNovoriBooks` is the common search implementation for Discover, stack creation, post creation, Ask Readers, and club pickers. Completed searches have a five-minute, 40-entry, memory-only cache in addition to the existing upstream cache. Concurrent identical searches share work; each caller receives an independent copy. Failures are not retained. Search matching, author refinement, edition grouping, ranking, and cover selection still run on cache misses.

Successful identity lookups have the same bounded local cache. Discover's ISBN/trending resolver also reuses successful public metadata. This does not cache reader-specific library, profile, cart, review, or access state.

Trending and Recent Releases already initialize from the Discover session cache and refresh in the background. Library exclusions continue to refresh when library mutations occur. Their lists and first-time identities still require network access when uncached.

Profile/feed covers and stack visuals use `BookCoverImage`, the shared canonical catalog selection, and Expo image memory/disk caching. This change does not replace artwork or bypass manual catalog selections.

Server ISBNdb responses remain fresh for seven days for search and 30 days for details. Existing response expiration is retained until refreshed. Local completed-search caches are intentionally shorter so current catalog choices can be checked regularly.

Validation: test returning to the same search in Discover and stack creation; open a book through your profile, another reader's profile, a post attachment, a stack, Trending, and Recent Releases; verify its identity, artwork, reading status, series, and back navigation. Compare repeated opens with a never-seen book. Device timing requires testing on the phone; automated cache tests establish reuse, expiration, mutation isolation, concurrent deduplication, and retry after failures.

Series artwork is now bound to existing English catalog editions by ISBN, title, and author. The server attaches `coverBookId` after reading a cached series payload; the client uses that identity with the shared cover selector. Raw Hardcover series `cached_image` URLs are not fallback artwork, and ISBNdb mode does not promote them into catalog selections. An uncached/unverified series entry shows a placeholder until a matching edition is cataloged. Verification uses database reads, not provider calls. Existing manual/locked catalog selections remain unchanged.

ISBNdb display normalization strips the explicit Standard Edition suffix and trailing Bokinfo source marker, while retaining the original title and publisher description. The standard/deluxe distinction can remain in edition metadata rather than in the main book title.

Canonical cover selector version 2 does not award ISBNdb artwork a bonus when its text details are fetched. After resolution, language/country and audio eligibility scores, equally scored ISBNdb candidates prefer known print editions and the earliest recorded release year/date. Incomplete dates are not treated as January 1; missing/invalid dates follow known dates. Equivalent candidates retain the current eligible winner rather than changing based on a newly discovered UUID. Existing provider quality tiers and locked selections remain protected. This is an edition-based preference, not image recognition: an opaque numeric provider URL cannot establish whether its pixels contain a prerelease placeholder.

The Iron Flame catalog export reproduced the regression: the complete 2025 paperback (9781649377579) scored 480 while the cached original 2023 print editions scored 460. Under the revised rule the stored 2023-10-31 print edition (9780349437033) wins without downloading another provider response or using uploaded artwork. Existing selections are re-evaluated on catalog reads; no cache purge or SQL migration is needed. After deploying all callers of the shared selector, restart the app and verify the selected provider image on the phone, including opening details and returning to the series list.
