# Admin book artwork corrections

Book artwork contains both the grouped report queue and a Novori book-link/ID/ISBN lookup for books without reports. Open a report and choose **Choose replacement cover**. Cached edition artwork and cover candidates load without provider requests. **Find more covers** explicitly searches ISBNdb and Hardcover; its editable query accepts a title/author or ISBN. These preview requests use provider caches, quota gates and usage logging. They never ingest catalog metadata or run a cover selector. Provider failures leave existing cached options available. Preview requests can still consume provider quota on a cache miss.

Each available option shows its image and available title, author, ISBN, publisher, publication date and language. Provider search results are options for human inspection, not automatically matched replacements. A supported stable provider image URL can also be pasted and previewed. Buttons remain disabled until the image loads. Confirm a choice and supply a reason to apply it. Browser image permission is restricted to the explicit supported provider hosts.

The service-only transaction creates a manual candidate, locks the existing work selection, and records the previous and next selections in private history plus the existing admin audit. Existing automatic selection code is unchanged. Other book metadata, edition identities, ratings, pages and provider preferences are not rewritten. Deployment itself does not change any covers. Owner/moderator authorization, active-account checks and the admin hub's existing MFA are required. Ordinary readers and support accounts cannot use correction actions. Expected revisions reject stale writes, request IDs make retries idempotent, and undo only restores a correction whose next selection is still current. Undo restores the previous candidate, lock, status and decision, rather than silently unlocking all books.

Report resolution remains a separate explicit action after verifying the correction. Corrections do not instantly invalidate devices: the existing cover-selection refresh cycle applies. Cached screens may need reopening or refreshing. No new native app build is required for this dashboard feature or individual corrections.

## Deployment

1. Pull `beta-updates` in the Novori Mac checkout, preserving local app.json/eas.json.
2. Export the copied Supabase CLI token (Database Read-write and Edge Functions Read-write for this project).
3. Run `node scripts/deploy-admin-cover-picker.mjs`. It applies only the targeted, repeatable migration and deploys only `novori-admin`. It does not deploy catalog/provider functions. Existing function secrets are reused.
4. Promote `beta-updates` to the live Cloudflare branch `phase5-ask-readers` with a fast-forward and verify the Cloudflare build succeeds.
5. Open Book artwork, paste a Novori book link, inspect cached and provider options, select the desired artwork and verify it in the app. The three requested corrections remain unselected until the administrator chooses the correct images.

Validation: admin build; regression tests for UI confirmation/failed images/unsafe URLs, cached previews, provider quota and failure handling, authorization, SQL transaction/idempotency/stale revisions/undo, plus existing admin tests. Provider responses are mocked in automated tests; live provider options and production schema/deployment require the deployment and verification above.
