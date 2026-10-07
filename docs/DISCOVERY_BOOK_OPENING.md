> The October 7 app-wide repair supersedes the earlier work-level Hardcover artwork policy below. See [CATALOG_APP_WIDE_REPAIR.md](CATALOG_APP_WIDE_REPAIR.md) for the current edition-proof requirement, all affected deployments and outstanding live checks.

# Discover listing and cover follow-up

October 7, 2026. Client follow-up to Phase 3.

## Confirmed failure paths

- Recent Releases and Trending both used a resolver before navigating. A missing edition ID stopped navigation with a Google-specific alert even though the configured provider can be ISBNdb. Endpoint/field names remain compatibility names; they do not prove a live Google request.
- The old fallback could accept the first search result without verifying title and author. A negative resolver envelope also qualified for the five-minute client identity cache.
- Discovery cards without a verified edition ID passed Hardcover ISBNs into the cover selector. A listing ISBN can refer to a different work/printing; the server discovery identity attachment verifies title/author but that client cover path bypassed that safeguard.
- Catalog responses had no read-order protection. A response started before a newer selection could overwrite it, including through an ISBN alias that was previously unknown to the client.

The user did not provide the affected book titles. These paths were established from code and regression reproduction; the precise deployed records/provider responses for those books remain unverified.

## Behavior

Both shelves immediately open their existing listing when no verified catalog ID is available. The view shows the available cover, title, authors and release/rating information while resolution runs. Verified matches proceed to the full book screen. Missing matches or network failures leave the listing readable with a retry. No edition ID is fabricated; saving/tracking/full metadata require a verified catalog edition. An absent description cannot be generated from an unavailable source.

Resolution uses the existing configured-provider identity endpoint, then title-only shared search with English/title/author/collection checks, then up to five additional unique valid ISBNs with the same identity verification. Positive results coalesce/cache; missing results remain retryable. Requests happen on opening an unresolved listing, not when rendering the shelves. Established catalog IDs need no new identity lookup. No raw Google endpoint was introduced.

A bounded session map carries resolved identities and later canonicalized detail identities back to both shelves. Identity includes listing ID, title and authors; stale listing snapshots cannot overwrite the remembered verified ID. Unverified listings use their existing artwork only, without ISBN cover lookup.

Catalog reads record an in-memory revision before leaving. A late response cannot replace a newer confirmed selection for its key or work, but a subsequent read may publish a legitimate new selection. Both batched cover reads and search cover reads use this protection. The revision is not persisted. Existing cover storage schema/key/retention, metadata cache keys/TTLs, artwork ranking, manual locks and image memory/disk policy are preserved. No wholesale cache refresh/clear, native dependency change, database migration or backend deployment is needed.

## Validation

- Full Jest: 83 suites, 901 tests pass (14 new regressions).
- App and typed-test TypeScript checks pass.
- iOS/Android production JavaScript/Hermes exports pass; these are not signed native builds.
- 17 website tests and 729 dependency/native notices pass.
- Regression reproduction covers late same-key/unknown-alias cover responses, valid later cover changes, missing-match retry, search identity rejection, alternate ISBN resolution, coalesced requests, immediate listing display, failure/retry, successful detail navigation, canceled late navigation, malformed route data, and canonical identity propagation.

Live acceptance remains: open the originally affected books, return to Discover repeatedly, and repeat on iPhone and iPad portrait/landscape. Verify deployed provider counters before claiming zero live upstream calls for cached metadata. This change does not improve a source file that is itself low resolution; it prevents stale/incorrect artwork selection from replacing a newer confirmed original.
