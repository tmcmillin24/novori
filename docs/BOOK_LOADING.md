# Shared book loading

All book entry points use `src/app/book/[id]/index.tsx`, including profile books, feed/profile post attachments, stacks, Discover results, Trending, Recent Releases, library, and club books. Metadata uses the shared `fetchGoogleBooksJson` memory/persistent/catalog/server cache path. The page resolves the existing canonical cover, displays the book, and loads optional series information separately for every source.

`searchNovoriBooks` is the common search implementation for Discover, stack creation, post creation, Ask Readers, and club pickers. Completed searches have a five-minute, 40-entry, memory-only cache in addition to the existing upstream cache. Concurrent identical searches share work; each caller receives an independent copy. Failures are not retained. Search matching, author refinement, edition grouping, ranking, and cover selection still run on cache misses.

Successful identity lookups have the same bounded local cache. Discover's ISBN/trending resolver also reuses successful public metadata. This does not cache reader-specific library, profile, cart, review, or access state.

Trending and Recent Releases already initialize from the Discover session cache and refresh in the background. Library exclusions continue to refresh when library mutations occur. Their lists and first-time identities still require network access when uncached.

Profile/feed covers and stack visuals use `BookCoverImage`, the shared canonical catalog selection, and Expo image memory/disk caching. This change does not replace artwork or bypass manual catalog selections.

Server ISBNdb responses remain fresh for seven days for search and 30 days for details. Existing response expiration is retained until refreshed. Local completed-search caches are intentionally shorter so current catalog choices can be checked regularly.

Validation: test returning to the same search in Discover and stack creation; open a book through your profile, another reader's profile, a post attachment, a stack, Trending, and Recent Releases; verify its identity, artwork, reading status, series, and back navigation. Compare repeated opens with a never-seen book. Device timing requires testing on the phone; automated cache tests establish reuse, expiration, mutation isolation, concurrent deduplication, and retry after failures.
