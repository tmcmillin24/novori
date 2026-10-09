# Artwork path audit — October 9, 2026

Scope: ISBNdb adaptation and revalidation, stored edition artwork, verified cross-edition borrowing, Hardcover feed protection, publisher-family proofs, canonical client publication and persistence, image failures, and the shared image component across search, author catalogs, barcode results, series, book details, library/profile, posts, stacks, clubs and recaps.

## Reproduced defects and corrections

| Defect | Effect | Correction |
| --- | --- | --- |
| Cached empty `imageLinks` is truthy and wins over a new provider image | A source can supply good artwork while Novori retains none | Keep only a usable previous image; empty/placeholder/expiring snapshots yield to current artwork |
| Adapter accepts only HTTPS input although the known ISBNdb image host also appears as HTTP metadata | A stable ISBNdb image is discarded before storage | Normalize that exact trusted host to HTTPS; continue rejecting credentials, signed/expiring URLs and placeholders |
| Own-image recovery uses the same author/language evidence required to borrow another edition's image | Incomplete bibliographic fields can hide an edition's own cover | Permit its own valid image with missing fields; known foreign language, audio and excluded products still fail. Cross-edition borrowing retains full verification |
| Image failure sets never expire in an already-running client | After the intended six-hour cooldown, a previously working URL remains excluded | Expire failure sets across known work aliases before publication/read. Server rejections, manual locks and protected Hardcover selections remain distinct |

## Preserved behavior

Verified Trending/New Releases Hardcover artwork stays primary and cached throughout the app. Other works keep ISBNdb primary and verified Hardcover series fallback. Manual locks, explicit artwork choices, edition IDs/ISBNs, title/rating/search ordering, provider TTLs, quotas and reader history are unchanged. No cache wipe, image URL rewriting for larger sizes, new provider fallback or forced upstream refresh is added. Recovery uses existing metadata and catalog requests. Stable legacy Google and publisher artwork is retained if usable.

All reader book-image surfaces found in the source audit use `BookCoverImage` and the canonical cover store. Club artwork and avatars have separate renderers by design. The previous series navigation fix separates reading-edition selection from artwork identity and remains intact.

## Verification and limits

Regression tests cover empty/placeholder metadata, stable HTTP normalization, expiring URL rejection, incomplete own-edition fields, strict foreign/audio/product filtering, exact verified cross-edition borrowing, cooldown expiry across aliases, protected Hardcover feed images, manual locks, publisher preferences, persistence and late-response races. Full-suite, TypeScript and mobile export results are recorded in the implementation response.

This is a source/data-flow audit with reproducible regression tests, not a live crawl of every cover. Production credentials and the newly reported title were not supplied. HTTP validity, pixel quality, provider website first-result equivalence and the selected live edition cannot be established by local tests. A provider website can show a different ISBN than its API response; expired cached metadata and rejected candidates can also differ. The existing `scripts/audit-catalog-covers.sh` reads stored catalog health without provider requests or credentials in output, but its findings require runtime review rather than assuming every unselected legacy candidate is a broken cover.

## Uploaded Lion diagnostic follow-up

The user's October 9 diagnostic establishes that ISBNdb search payloads and stored editions already contain artwork for In a Pit with a Lion on a Snowy Day. It disproves missing-ingestion as the explanation for these records. Google and ISBNdb both use compatibility ID `7g4GFBzTI6QC` for ISBN 9781601422088; Google's stored images carry `imgtk` parameters, while ISBNdb has a stable image. Another legacy Google ID has no own image.

Reproduced generic defects: a legacy Google seed's own ID outranked verified ISBNdb artwork on another edition; ISBNdb detail could select an earlier Google row with the same compatibility ID; and revalidation treated Google's tokenized image as a durable previous cover. The selector now ranks ISBNdb before legacy requested-ID preference, while keeping own-edition preference within the same provider, manual locks, explicit artwork preferences and protected Hardcover priority. Detail reads prefer the ISBNdb row for duplicate IDs. Revalidation retains stable legacy covers but yields tokenized ones to current stable images. Public bibliographic records from the diagnostic are replayed in endpoint/search tests; Google image tokens in the fixture are replaced with a placeholder.

The replay proves these records resolve to publisher artwork through the tested server/search paths. It does not prove the image CDN returned decodable bytes on the user's device, that these were the exact active runtime entries, or that cached failures/manual locks were absent. No additional provider query, cache wipe, edition-ID migration or per-title runtime rule was introduced. Deploy shared consumers and reload the client; if the phone remains blank, inspect its selected URL and image error rather than reporting a missing provider cover.
