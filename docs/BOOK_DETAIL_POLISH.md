# Book detail presentation and repeat loading

## One loading layout

Discovery resolution and edition-detail loading use the same BookDetailLoading component. The cover, title, author and navigation geometry match the final detail hero (including the compact Library variant). Unavailable fields use static, inaccessible placeholders rather than changing to another centered splash screen. Discovery keeps this view until replacement navigation completes; the internal handoff has no second slide animation. The private status retry appears only on error, avoiding a loading-text row that moved the cover down temporarily. Existing book identity resolution and failed-listing fallback remain intact.

Library navigation passes its known title/authors and only a currently selected canonical cover as presentation hints. It never supplies an obsolete library image as a new preferred artwork choice.

## Public device cache

A separate `novori:public-book-extras:v1` record retains successfully resolved Hardcover rating/counts, series responses and public work-representative lookup results. It is bounded to 100 entries and 512,000 serialized characters; oversized individual results, malformed/future/expired entries, negative results and lookup errors are not retained. Freshness is 24 hours with up to seven days of last-known data; stale reads return immediately and coalesce one background refresh. Disk and request failures do not erase valid retained results. Exact book/ISBN keys separate edition-specific extras. No library ownership/status, private notes, user reviews, auth material or community-review bodies enter this cache.

Valid cached ratings/series render without waiting for the separate work-enrichment promise. Cold misses still use the existing matching path and existing Edge functions/provider quota logging. Work lookup reuse preserves the existing sameBookWork checks and never changes the edition's ID, ISBN, pages or art.

Persisted series snapshots never republish covers, page counts or publication metadata into their authoritative stores. Only fresh server series responses follow the existing publication path. Series metadata becomes visible before the current-book cover read finishes. Offscreen series covers no longer prefetch while the dropdown is closed; opening it uses the existing shared resolver and missing-cover queue. Global cover ranking, manual locks, cover cache retention and recheck intervals are unchanged.

## Tap cover to enlarge

Both Discover and Library detail heroes use EnlargeableBookCover. It opens the shared canonical URL already selected by BookCoverImage, including manual corrections, in the existing full-screen viewer. The viewer's explicit book-cover mode uses Expo Image memory/disk caching and contain fitting. It does not select an edition, request another provider image or rewrite URLs. Close/backdrop/hardware back return to the same detail screen. Missing images cannot open an empty viewer. A different book key closes the old preview.

## Remove from Library

A labeled destructive action appears below book details for a saved library member, including ownership-only and rating/review-only entries. It uses the same RemoveBookConfirmSheet shown by the Library’s … menu, with the existing removeUserBook path. A confirmation snapshot keeps the warning stable during its closing animation; failed deletion leaves the sheet open for retry. Confirmation describes deletion of saved rating/review and, where applicable, private Reading Details. Cancellation makes no write; successful deletion clears local saved state and invalidates late private reads. The existing library mutation version refreshes Library. Catalog/cover caches remain public and reusable after removing a personal entry.

## Validation and rollout

Tests cover restart hits, stale background refresh, request coalescing, corrupt/expired/negative data, bounded persistence, mutation isolation, cached extras bypassing enrichment, no cached-series artwork replay, stable loading geometry, exact-artwork enlargement, and confirmed removal. Existing book-resolution and cover tests remain required. Actual cold-network latency and physical device appearance need device verification.

No backend migration, provider-function deployment or new dependency is required. Pull beta-updates and reload the development client. TestFlight distribution requires a new build.
