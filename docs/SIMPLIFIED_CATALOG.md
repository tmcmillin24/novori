# Simplified catalog policy

This supersedes the automatic Hardcover artwork promotion described in the previous catalog repair notes.

- Relevant books rank by matched Hardcover readership, then existing popularity fallbacks. Companion journals, guides, calendars, coloring books and collections occupy a lower tier. Duplicate standard editions retain preference over marketing variants. A supplementary product cannot contribute ISBNs or artwork to a novel group.
- Search popularity uses the existing cached, quota-controlled endpoint. One-result searches skip it; repeated completed searches reuse the client cache. A cold multi-result search can require popularity lookup. Failures preserve usable book results.
- English catalog artwork is the automatic cover source. Hardcover remains a source of readership and verified series membership, but its images cannot replace catalog artwork, even when its edition identity is correct.
- Existing eligible selections remain stable across metadata fetches, series lookups and discovery reads. Manual locks remain untouched. Missing/ineligible selections can be resolved from stored candidates. Audiobook artwork is not retained when eligible print artwork exists. Publication dates do not establish cover quality.
- Discovery overlays the same stored selection; its verified catalog ID survives navigation. Unresolved records show a placeholder until resolution, rather than retaining an unverified Hardcover photo.
- No cache wipe, rating migration, book-ID replacement or bulk provider refresh is included.

## Rollout and limits

Deploy the shared helper consumers with `bash scripts/deploy-catalog-repair.sh`, using the saved Supabase personal access token environment variable. Restart the app bundler afterward. This workspace has no authenticated live Supabase access, so production deployment and visual validation on devices remain outstanding.

This policy prevents automatic Hardcover photo/angled-cover substitution. It cannot prove that every existing ISBNdb/Google image is attractive, sharp or the desired edition. Eligible existing catalog selections are deliberately retained. Inspect live selections and original images before claiming the reported books or all series are visually correct. Series completeness still depends on verified provider membership and matching catalog editions.

## Validation

TypeScript checks and all 88 test suites (936 tests) pass. Regressions cover popularity ordering, companion products remaining below novels, separated product ISBNs, repeat-query cache reuse, stable eligible covers, foreign-cover retirement, manual locks, series making no artwork writes, and unresolved discovery artwork. iOS and Android JavaScript bundle exports also pass. These checks exercise implementation behavior; they do not establish production image quality.
