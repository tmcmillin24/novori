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
