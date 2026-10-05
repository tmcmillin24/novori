# ISBNdb rollout

This is an additive rollout from protected commit `4962f3e`. Discover/search layout, relevance filters, work grouping, Hardcover enrichment and reader-owned records remain in place. Production is unchanged until the server provider switch is enabled.

## Deploy in this order

1. Pull branch `phase5-ask-readers`.
2. Run `supabase/migrations/20261005130000_isbndb_provider.sql` in Supabase SQL Editor as the project administrator. `docs/deployment/ISBNdb-setup.sql.txt` contains identical SQL. The migration is safe to rerun; it does not erase caches, selections or reader data.
3. Keep `ISBNDB_API_KEY` in Edge Function Secrets. Do not put it in Expo public variables, git, a mobile build or chat.
4. Deploy every function that imports the changed shared cache/catalog code:

```bash
npx supabase functions deploy google-books-search --project-ref oanpmuiuuwljknwvyzev
npx supabase functions deploy google-books-detail --project-ref oanpmuiuuwljknwvyzev
npx supabase functions deploy google-books-resolve --project-ref oanpmuiuuwljknwvyzev
npx supabase functions deploy book-cover-selection --project-ref oanpmuiuuwljknwvyzev
npx supabase functions deploy hardcover-series --project-ref oanpmuiuuwljknwvyzev
npx supabase functions deploy hardcover-search-popularity --project-ref oanpmuiuuwljknwvyzev
npx supabase functions deploy hardcover-trending --project-ref oanpmuiuuwljknwvyzev
npx supabase functions deploy hardcover-recent-releases --project-ref oanpmuiuuwljknwvyzev
npx supabase functions deploy open-library-work-cover --project-ref oanpmuiuuwljknwvyzev
npx supabase functions deploy novori-admin --project-ref oanpmuiuuwljknwvyzev
```

5. In Edge Function Secrets add `NOVORI_BOOK_PROVIDER` with value `isbndb`. This controls all readers on this project, including earlier app builds; there is no per-account allowlist in this initial rollout. Enable it while the current small test group is using the project. Saving the key alone does not enable ISBNdb.
6. Reload the updated app on both Metro ports (8081/8082) and completely restart the phone app. There are no new native dependencies, so this change does not require a native package rebuild. Local detail cache keys are versioned to v5; existing catalog data, approved cover selections and reader rows are not deleted.
7. Refresh Cloudflare's admin/public Pages deployments from the updated git commit to get the ISBNdb dashboard card and provider disclosures. Review ISBNdb's subscription terms for metadata caching and cover use before public launch.

## Test before inviting more readers

- Search `The Perfect Son`, `The Perfect Son Freida`, and the full author name; check Freida McFadden is represented and wrong-author results are not treated as that book.
- Search `Hunting Adeline`; check H. D. Carlton versus H. E. Carlton. Also test `The Inevitable Ruin` and its different authors.
- Inspect Fourth Wing, Project Hail Mary, and Terminal List books 4 and 6 in Discover, book details, Library, and series. Retain existing approved/manual selections. Inspect cover sharpness on the phone.
- Search a previously unseen title, add it to Library, record progress, add a private note and review, close/reopen the app and reopen the book.
- Open existing saved books and confirm progress, notes, reviews and stack links still work. Look for duplicate saved books.
- Scan a valid ISBN-13 and ISBN-10. Check unknown editions and missing covers without assuming the provider has every ISBN.
- Repeat identical searches on two accounts. After the shared cache fills, upstream counts should stop increasing for that query. A different query or page, detail lookup, or enrichment can legitimately make another request.
- Monitor ISBNdb's own quota and Novori's daily/week/month admin totals. Novori counts admitted request attempts, including failures; it is not a provider billing statement. This adapter makes individual search/ISBN requests and does not use bulk lookups. ISBNdb's bulk lookup charges each ISBN separately if that endpoint is used later.
- In function logs, an ISBNdb-enabled request must not reach Google's upstream API. GraphQL calls to Hardcover remain expected.

## Current controls and limits

- Global admission control uses a database advisory lock and a 1.1 second minimum interval across Edge Function instances and UTC midnight. Contending requests wait for up to eight seconds, then return a retryable unavailable/busy result. This is a bounded wait, not an unlimited work queue.
- Reserve 500 of the advertised 5,000 daily quota units: Novori admits up to 4,500 request attempts per UTC day. Reader-facing misses are capped at 250 per reader per day. Internal authenticated Hardcover fallback requests share the global allowance. Quota claims happen only after shared-cache misses.
- ISBNdb request keys are separate from Google's. Search responses stay fresh for seven days, with a bounded fallback window of 14 days from fetch. Book details stay fresh for 30 days, with a bounded fallback window of 60 days from fetch. Expiration jitter can extend these durations by up to 15%; refresh leases remain 60 seconds. Existing cache entries keep their recorded expiration until refreshed; this change does not invalidate them. Confirm the subscription permits these retention periods; adjust them before public rollout if required.
- Stable `nv_<ISBN13>` IDs are Novori IDs, not claimed Google IDs. Existing matching ISBN/title/author records keep their legacy ID through `novori_book_provider_ids`. Legacy `google_book_id` column and envelope names remain compatibility fields; normalized metadata and canonical candidates explicitly record source `isbndb`.
- Matching an existing ISBN/title/author preserves that specific edition's identity. Different editions can still have distinct IDs, as before; this is not a destructive work/edition merge.
- Covers use ISBNdb's standard `image` link, documented as at most 500 pixels high. Known placeholder URL names and insecure/unexpected hosts are rejected, but a valid-looking URL can still contain placeholder art: visual testing is required. There is no guarantee every cover improves. Existing canonical/manual selections continue to participate in selection.
- `image_original` URLs expire after two hours and are intentionally never stored or returned. Original-image ingestion/self-hosting is **not implemented** in this change; it requires verifying storage/display rights and testing actual source images. Do not enable this rollout believing all covers have been replaced by high-resolution originals.
- ISBNdb has its own namespace, but the existing shared book catalog and user associations are preserved. Legacy provider content is not retroactively licensed by buying ISBNdb. Track provenance and separately review legacy metadata/cover retention before launch.

## Rollback

Change Edge Function Secret `NOVORI_BOOK_PROVIDER` to `google_books` to restore the previous routing. Only use this while the previous provider remains permitted for the intended deployment. Do not delete the new identity/cache tables. Newly saved `nv_` books still use the ISBNdb detail adapter so those library links survive; keep the ISBNdb key active during rollback. Existing alias IDs remain unchanged. Restart the app to clear its ten-minute search memory cache.

## Verification boundary

Automated tests cover adapters, identity preservation, ISBN checksums, authentication, concurrent cache misses, provider routing, rollback details, quotas, database permissions/cascading deletion, and existing app behavior. SQL is exercised against PGlite PostgreSQL. The hosted migration, real subscription responses, provider cover quality and on-device behavior must still be tested after deployment; local checks cannot certify those outcomes.


## Format follow-up

ISBNdb bindings now survive adaptation. Surname-first personal names normalize for grouping/display. Ordinary work search prefers non-audio representatives over MP3/CD editions of the same work and avoids borrowing narrator artwork when an eligible non-audio cover exists. Audio-only results remain available and ISBN lookup still resolves their own editions. Audio disc counts are omitted from reading page counts. ISBNdb cache keys advance to v2; no catalog/user records are wiped. Deploy all listed functions importing shared provider/catalog/selector code after pulling this fix, then reload Metro/the phone app. No additional SQL is needed.
