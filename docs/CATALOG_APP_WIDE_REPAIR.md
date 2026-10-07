# Catalog and cover repair — October 7, 2026

Status: implementation and local regression verification; production deployment and live artwork verification remain outstanding. Passing fixtures does not establish that Hardcover/ISBNdb currently returns the right artwork for every book.

## Confirmed defects

- Previous series promotion matched an English Novori edition, then promoted Hardcover's **work-level** image. That image was not proven to belong to the English edition. Selector v3 trusted `series_verified` without that proof, even without locale metadata.
- Trending/recent-release previews also used work-level images and ISBNs from mixed-language editions.
- Series search inspected only the first Hardcover hit. A duplicate record without membership prevented a later correct record from being considered. ISBN matches did not also validate the requested title/author.
- Search result taps still requested another canonical-ID resolution. This could switch editions after rendering the result.
- Different legacy work rows could expose different cover availability for equivalent English title/author metadata. ISBN collisions used database row order.
- The device cover store ignored null selections. An explicitly rejected image could survive in saved snapshots or persistent cache.
- Numerous saved-book views rendered raw title text instead of the shared work-title formatter.

## Implemented behavior

1. Hardcover artwork comes from an explicitly English edition with matching work title, ISBN, edition ID and its own image URL. Store that proof with the candidate. Raw work images cannot be promoted. English edition queries are bounded and ordered by release date; known print editions are preferred. This does not visually certify a matching publisher design across a series.
2. Selector v4 rejects legacy unproven automatic series candidates and chooses eligible stored alternatives. Manual locks remain authoritative. No candidate rows or book metadata are deleted.
3. Cover responses communicate rejected URLs. The shared device store retires those URLs across known work aliases, persists bounded rejection data, and guards against late responses overwriting a newer selection. Ordinary missing responses and offline errors do not invalidate good covers.
4. Catalog-only, title/author/language-verified aliases let equivalent cached work rows share a deterministic selected cover without changing saved IDs, ratings, shelves or edition metadata. Ambiguous ISBN collisions cannot choose unrelated works by row order.
5. Series lookup validates title/author for ISBN matches and tries up to five verified duplicate search hits until membership is found. English catalog lookup no longer infers a preferred language from an arbitrary first edition or makes a Google language lookup.
6. Verified Discover search taps preserve their selected ID. Existing shared detail validation still checks the clicked work.
7. Book-title displays use the shared formatter on search/author/detail, saved Library/profile/reader/review, feed/post/composer, stack, club, currently-reading, daily check-in, reading details, orbit tracker and continuing-journey views. User-authored posts, club/event names and timeline event prose are not rewritten.

## App-wide coverage

All 48 book-image placements in 33 consuming files use `BookCoverImage` and the same shared canonical store. The audit checked image guards as well: a valid book ID mounts the renderer even when a saved cover URL is missing. Detail series cards first require a verified catalog identity; their existing missing-cover queue resolves uncataloged series rows.

| Areas | Cover path | Title path |
| --- | --- | --- |
| Discover, author, book details, series | Shared renderer/catalog; English preview artwork | Shared work-title formatter |
| Library, profile, reader, saved reviews | Shared renderer/catalog with saved IDs | Shared work-title formatter |
| Feed, post details, Ask Readers, post/review/update composers | Shared renderer/catalog with saved IDs | Shared work-title formatter |
| Stacks and club books/events/discussions | Shared renderer/catalog with saved IDs | Book titles formatted; user content preserved |
| Currently reading, daily check-in, tracker, reading details, recap/goal/year shelves | Shared renderer/catalog with IDs/ISBNs | Visible book titles formatted; recap/event prose preserved |

Club artwork, avatars and uploaded post photos remain their own media. Notification entity thumbnails are a separate generic media field; the client response does not supply a book identity, so this repair does not reinterpret them as catalog covers.

## Cache and API safeguards

- No broad cache clear, data migration, new provider, API-key change or library/rating rewrite.
- Cover reads use existing catalog tables only. Shared provider caches, quotas, usage tracking and refresh locks remain in place.
- Series derived cache is v3, trending v6 and recent releases v3. Changed English-edition GraphQL queries require a first fetch when absent, then use the normal shared cache. Unchanged provider requests remain reusable. New proof cannot be reconstructed from old work-level images alone.
- Duplicate series lookup can need additional bounded cached Hardcover lookups on a cold miss. Repeated identical requests use the response cache.
- Persistent device covers retain the existing bounded v1 record. Only rejected work-scoped URLs are retired; valid/manual originals retain their original image URLs and memory/disk image caching.

## Local validation

- 88 Jest suites / 932 tests pass, including mixed-language discovery previews, duplicate series records, same-work/different-author cover aliases, manual locks, rejection persistence and actual club/stack/recap/detail components.
- Application and test TypeScript checks pass.
- iOS and Android production JavaScript/Hermes bundle exports pass. These are not signed native builds or device acceptance tests.
- Fixtures use representative provider responses; they are not exports of the live Hunger Games catalog.

## Release procedure

Pull `phase5-ask-readers`, then from the project root run:

```bash
bash scripts/deploy-catalog-repair.sh
npx expo start --dev-client --port 8082
```

The script deploys all nine Edge Functions that consume changed helpers, including the legacy Open Library function so it cannot retain an older selector. It does **not** enable that fallback or change provider configuration. No database migration or dependency installation is required by this repair. Reload the development client; an installed TestFlight binary would require a new compatible build/update.

## Live verification still required

Run `docs/diagnostics/catalog-cover-audit.sql` and review actual selected image URLs. Check The Hunger Games/Catching Fire/Mockingjay, ACOTAR/Mist and Fury, and Dungeon Crawler Carl (including Cookbook, Butcher's Masquerade and Bedlam Bride), plus Fourth Wing/Iron Flame and the manual Terminal List cover.

For each: search the plain title and a title + series + book-number phrase; open each result; open through series, Library, profile, feed/stack and tracker; close/reopen the app; repeat with network unavailable after hydration. Verify English art, original work labels, consistent series membership, no image reversal and unchanged ratings/manual selections. Inspect actual iPhone/iPad screens in both orientations. Matching art families require looking at the live images, not merely their metadata.

Workspace limitations: no authenticated Supabase deployment/database connection and no attached native device. Earlier audit artifacts and repository history were reviewed; the exact full contents of every earlier Novori chat were not retrievable. Deployment and live visual correctness must not be reported as completed from local tests.
