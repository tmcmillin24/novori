# Novori moderation setup

The code is prepared and tested locally. It is not active in your Supabase or Cloudflare account until you complete these steps. Keep RLS enabled. Do not put an OpenAI key, Supabase service key, or origin secret in the app, GitHub, or chat.

## 1. Pull and stage the database

In VSCode, from the Novori repository root:

```bash
git pull origin phase5-ask-readers
```

In Supabase → SQL Editor, run the entire `supabase/migrations/20261005180000_ugc_screening.sql`. The identical text-only copy is `docs/moderation-stage-sql.txt`. Run it as the SQL Editor's postgres role; leave RLS enabled. It creates private screening/approval tables, priority queues and guards, with **enforcement OFF**. The moderation quarantine bucket is private immediately. Do not run the activation SQL yet.

## 2. Add the two private secrets

Create an API key at https://platform.openai.com/api-keys. In Supabase → Edge Functions → Secrets, add:

- Name `OPENAI_API_KEY`; value your OpenAI API key.
- Name `NOVORI_MEDIA_ORIGIN_SECRET`; value a new random 64-character secret. Generate one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it in your password manager. Use this exact same secret for the Cloudflare Worker in step 4.

This uses OpenAI's free `omni-moderation-latest` endpoint, not a paid chat/completions model. API rate limits still apply. Existing Resend/admin-worker/deletion-worker secrets stay in place.

## 3. Deploy the Supabase functions

```bash
bash scripts/deploy-moderation.sh
```

The script uses **npx supabase**, sets the matching legal version, and deploys `ugc-publish`, `ugc-media`, `ugc-signup`, `ugc-media-origin`, `novori-admin`, and the updated `account-deletion-worker`. `--no-verify-jwt` is deliberate: the handlers themselves verify reader sessions, signup receipts, admin roles/MFA, or the private worker/origin secret. It is not anonymous publication.

Wait for both Cloudflare Pages projects to deploy the new commit: the admin hub and public website/privacy pages. If a Pages project does not auto-build this branch, redeploy its latest production commit.

## 4. Deploy protected image delivery

In Cloudflare DNS for **novori.link**, add a **proxied** CNAME named `media` targeting `novori.link`. The orange-cloud proxy must be enabled. The Worker handles the route before any origin fallback.

From the repository root:

```bash
npx wrangler login
npx wrangler secret put NOVORI_MEDIA_ORIGIN_SECRET --config moderation-media/wrangler.jsonc
npx wrangler deploy --config moderation-media/wrangler.jsonc
```

When prompted for the secret value, paste the same secret from step 2. The config binds `media.novori.link/*` in the novori.link zone and uses the existing Supabase project. There is no R2 or Cloudflare Images subscription in this implementation. Workers Free has a daily request limit; media delivery and existing Supabase bandwidth/storage are not a promise of unlimited free hosting.

In Cloudflare → **novori.link → Caching → Configuration → CSAM Scanning**, enable scanning and configure your monitored email address. If the dashboard has moved, search its settings for “CSAM”. Keep Development Mode off for this route.

Cloudflare's tool matches **known** CSAM in images entering its cache, attempts to block matches, and sends daily notifications. It is supplementary protection, not an upload approval API, a detector for every abusive image, or a guarantee against first-display exposure. The Worker caches image bytes in the zone using the Cache API. **Confirm scanner coverage for this deployed Worker route with Cloudflare; a cache HIT alone does not prove scanning.** Do not test with illegal imagery. No live zone setting or scanner coverage was verified by this source-code work.

## 5. Screen existing uploaded images

On your computer, create a temporary `novori-moderation.env` file **outside the Novori project folder**, in its parent directory. Do not import operator credentials into app code:

```text
EXPO_PUBLIC_SUPABASE_URL=https://oanpmuiuuwljknwvyzev.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SUPABASE_SECRET_KEY
OPENAI_API_KEY=YOUR_PRIVATE_OPENAI_API_KEY
```

Use a modern `sb_secret_...` Supabase secret key for `SUPABASE_SERVICE_ROLE_KEY`; the variable name is retained for script compatibility. These are local operator credentials. Never copy the service/OpenAI keys into the app's public environment variables.

Inventory first, then apply:

```bash
node --env-file=../novori-moderation.env scripts/moderate-existing-media.mjs
node --env-file=../novori-moderation.env scripts/moderate-existing-media.mjs --apply
```

The script is sequential and resumable. It screens existing avatars, post photos and club covers. It does not touch ISBNdb/Hardcover artwork or the book cache. Passed assets are registered; flagged legacy images are blocked on the protected route and queued for review. They remain accessible at their old public origin until step 7 makes the buckets private, so review serious flags immediately. Approval of a migrated legacy image restores delivery; approval of a new image lets the reader upload the same image again. A rejection blocks the exact image hash across filenames for that reader.

Keep the temporary credentials file locally through step 7, then remove it, or keep it only in protected local credential storage. Do not send its contents to support/chat.

## 6. Connect the app and test before activation

Add only this public value to your existing Expo `.env`:

```text
EXPO_PUBLIC_MODERATION_MEDIA_ORIGIN=https://media.novori.link
```

Restart both Metro servers so both simulator and phone load the new bundle/environment. No new native library was added. Existing cached user-media URLs are resolved at render time; catalog covers and local image previews retain their existing paths.

Use a disposable, ordinary account and accept the updated legal notice. Test safe posts/comments, profile text/avatar, a public library review, stack names/items, club cover/details, discussions/poll options, shared club-reading notes and events. Test creation **and edits**. A safe image should render through media.novori.link; a repeated request should show `X-Novori-Media-Cache: HIT` in an HTTP check. Requests to `ugc-media-origin` without its secret must fail. This proves routing/caching, not CSAM matching.

Use harmless synthetic fixtures/mocked scanner responses to test flagged submissions. Do not create illegal imagery. Verify Admin → **Flagged submissions**, reason-required approval/rejection, reader notification, same-content resubmission, and the appeal approval path for rejected items. The old approved version of an edit remains visible while a replacement is held. An outage must prevent new unscreened publication while existing reading content remains available.

Run `supabase/verify-moderation.sql` in SQL Editor. Inspect the installed publication/lifecycle RPC bodies: their originals predate the versioned SQL in this repository, so local tests cannot prove those installed definitions. Ensure removal/deactivation/cancellation RPCs only remove/mask or restore previously published content; the guard exempts those lifecycle paths. Check reported catalog image hosts against the server allowlist. If a legitimate catalog host differs, verify the provider then add its exact hostname to Supabase secret `NOVORI_CATALOG_IMAGE_HOSTS` (comma-separated); redeploy ugc-publish. Do not allow arbitrary user image hosts.

## 7. Activate, then verify the protections

Only after the updated app, functions and media route work, make the buckets private through the supported Storage API:

```bash
node --env-file=../novori-moderation.env scripts/make-moderation-media-private.mjs
```

Then run **`supabase/enable-moderation.sql`** (identical copy: `docs/moderation-enable-sql.txt`). It refuses activation if existing uploaded images are unregistered, requires the four image buckets to be private, and enables database/Storage/signup guards.

Then confirm:

1. Safe signup and all safe published-content paths still work. Existing users must accept the new terms before publishing.
2. A direct REST/RPC text write without a gateway receipt and a direct Storage upload/overwrite fail. A reader also cannot download or sign raw private media with their JWT to bypass the image route. Old clients cannot bypass the checks. Fresh raw Supabase public URL requests must no longer serve the private images; allow provider cache invalidation to complete and verify this rather than assuming direct SQL purged a CDN. Previously downloaded device copies cannot be retroactively erased.
3. Five **different** disposable readers report one test item: it becomes Urgent and sorts before normal reports; three reporters give High. One reader repeating a report must not increase distinct-report priority. This is queue priority, not automatic deletion.
4. Removal preserves existing comment replies, revokes photo delivery, and records its reason. Profile image removal is available on profile reports. Suspension stops existing signed-in sessions from posting; blocking still prevents interactions. Restore access and retest.
5. Deactivate, restore, and permanently delete a disposable account. New registered/quarantined media must be removed before Auth deletion; the existing deletion email/login flow must still work.
6. Confirm Admin Settings worker heartbeat, opted-in report/screening email delivery, and Cloudflare's configured alert email. Email contains no flagged content. Cloudflare alerts require operator follow-up; they are not automatically imported into the Novori queue.

## Daily operation and submission notes

Check Reports and Flagged submissions at least twice daily; address urgent safety matters promptly. Review the actual context, remove policy violations and restrict repeat offenders. Treat an AI flag as a request for review, not proof of misconduct. Handle appeals via support@novori.link and record reasons in the dashboard. Do not redistribute suspected CSAM or send known/suspected CSAM to the general moderation endpoint; follow the child-safety response procedure and appropriate reporting requirements.

Before store submission, audit existing shared **text** too: this change does not silently certify old posts/profiles as safe. Current in-app report targets remain posts, comments and profiles; separate library reviews, stacks, clubs/events/shared notes must have a tested reporting route or clear support reporting path. Verify copied notifications/previews and mirrored reviews when removing content. These are remaining launch checks, not a claim that every old backend path passed a live audit.

Provide exact report/block instructions and a working **non-admin** reviewer account in the stores' private review-access fields. State only deployed behavior and supported image categories. OpenAI's image moderation does not cover every text-only category or establish comprehensive CSAM detection. Store acceptance remains a reviewer decision.

Sources: OpenAI https://developers.openai.com/api/docs/guides/moderation ; Cloudflare https://developers.cloudflare.com/cache/reference/csam-scanning/ and https://developers.cloudflare.com/workers/platform/limits/ ; Apple https://developer.apple.com/app-store/review/guidelines/ ; Google https://support.google.com/googleplay/android-developer/answer/14747720 .
