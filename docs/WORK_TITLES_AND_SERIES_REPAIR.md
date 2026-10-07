# Work titles, edition identity and series artwork repair

October 7, 2026. Follow-up to the discovery cover changes.

## Findings and implemented behavior

Provider edition text was leaking into work presentation: sentence-cased ISBNdb titles, collector labels, and numbered series parentheticals survived the narrower shared title cleaner. Work enrichment also copied the representative edition's publication date onto another ISBN. Discover re-resolved already verified catalog identities; the series resolver had substring/ISBN fallbacks that could accept unrelated products. ISBNdb mode explicitly disabled verified Hardcover series artwork promotion, leaving individual ISBNdb printing covers to represent the series.

- Shared work title presentation now removes explicit edition and numbered series labels, repairs title capitalization, and keeps meaningful subtitles, acronyms, mixed-case proper names and distinct box-set identities. Original provider titles remain traceable in edition metadata.
- Already verified discovery identities open directly without another canonical identity lookup. Work enrichment retains the selected edition's ID, ISBN, artwork and edition date; verified original publication records remain separate. Cleaned work titles can now match the existing original-release facts.
- Search prefers an earlier dated plain English edition ahead of later reissues when format, edition-label intent, title match and locale already agree. This does not invent a first-publication date from an arbitrary ISBN date.
- Every series resolver candidate must pass the shared exact cleaned title, normalized author and English checks, including ISBN and broad-query fallbacks. An ISBN cannot override an unrelated title/author. Series navigation carries the actual work title instead of provider marketing text. Rows by unrelated authors are excluded from the displayed series.
- ISBNdb mode restores verified Hardcover series artwork candidates from the existing cached series response. Each row needs a matching English catalog edition with the same title/author; catalog ISBN and remembered alternative-printing IDs are both supported. The same existing selector chooses originals for all surfaces, and manual locks remain authoritative. No client-only image substitution or new external cover source was introduced.

Book three of Dungeon Crawler Carl is legitimately **The Dungeon Anarchist's Cookbook**; it must remain a novel with its verified cover, not be removed by a blanket cookbook filter. Official source: https://mattdinniman.com/books/ . ACOTAR work titles: https://sarahjmaas.com/reading-guide/ . No publisher/author-site artwork was imported into the app.

## Validation

86 Jest suites / 919 tests pass. Tests cover reported capitalization, collector titles, ACOMAF's series suffix, original-release matching, edition identity/date/cover preservation, unrelated cookbook and prefix-title rejection even with a matching ISBN, alternate-printing cover verification, stable artwork URLs and catalog-only candidate promotion. App/test TypeScript checks, iOS/Android production bundle exports, 17 website tests and 729 notices pass. Existing selector tests cover manual locks and original print preference. These are not signed native or live catalog/device acceptance tests.

## Deployment and remaining verification

The client implementation is complete; the series artwork repair requires deploying the backend code. This workspace has no Supabase deployment token/connector, so no live function was deployed or live catalog record repaired here. After pulling, run from the Novori project:

```bash
for function_name in google-books-search google-books-detail google-books-resolve hardcover-series; do
  npx supabase functions deploy "$function_name" --project-ref oanpmuiuuwljknwvyzev || break
done
```

Reload the existing development client. Open ACOTAR and ACOMAF from search and the series dropdown, then open Dungeon Crawler Carl and expand its series. Existing cached Hardcover responses can now restore verified series artwork without a fresh provider fetch. Inspect books three, five and six and return to Discover. Exact live images, visual family consistency, deployed function success, original-release facts and provider counter deltas remain acceptance checks; the local fixture tests cannot prove those catalog records. No cache wipe, schema migration, dependency reinstall or native rebuild is required.
