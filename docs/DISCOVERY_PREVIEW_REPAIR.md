# Discovery preview and cached-cover recovery

The previous simplification removed unverified Hardcover previews but resolved missing catalog identities only on tap. Recent Releases also discarded entries with a missing preview URL. Those two paths produced blank Trending covers and a shortened release row.

Mounted cards now load their verified catalog identities and selected covers through the same cached resolver used by taps. A bounded queue allows two cold identity lookups at a time; repeated mounts reuse results. The full 100/150-book provider pool is not prefetched. Existing publisher previews do not require identity resolution.

The shared cover endpoint recovers English publisher images already present in edition metadata when candidate rows are absent. Recovery includes verified aliases, rejects other authors/works and translated or supplementary records, and preserves manual locks. It makes no upstream requests. This endpoint serves the shared renderer throughout the app.

Recent Releases retains entries while covers load. Existing library exclusions, ranking, author diversification and Trending exclusions remain intact. The row can still contain fewer books when too few eligible titles remain.

Verified series membership is cached by cleaned work title and normalized author across printings, rather than separately per ISBN. ISBN-only or authorless requests remain isolated. The derived cache version changes; raw provider caches, quotas and refresh locks remain intact.

The owner's Threshing Day choice is ISBN 9781682818527. Shared selection prioritizes that English edition's actual catalog artwork, preserving manual locks. Discovery and ISBNdb search resolve that edition through the existing cache and quota path; its ISBN never replaces saved reader IDs or ratings. If the provider has no artwork for it or the lookup fails, no replacement image is fabricated.

## Validation and rollout

TypeScript checks and 91 suites / 959 tests pass. Tests cover unrelated titles, candidate-less cached artwork, separate work/author identity, variant-ISBN series cache reuse, preview loading without taps, repeated-mount reuse, two-request concurrency and the actual Recent Releases filter. iOS and Android JavaScript bundle exports also pass.

Deploy shared helper consumers using `bash scripts/deploy-catalog-repair.sh`, then restart the device bundler. With the saved personal token still exported, `bash scripts/audit-catalog-covers.sh` inspects every catalog work and reports missing/legacy selections without making book-provider requests. It reads no reader data. The audit reports metadata/selection health; it cannot determine whether a particular image is blurry or angled.

No live Supabase access is available in this workspace. Production audit results and visual device verification remain outstanding; fixture tests are not proof of every live cover or series.
