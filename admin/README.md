# Novori Admin — admin.novori.link

Private community operations dashboard, separate from the public website and the Expo app. Reports use the existing `content_reports` queue. All sensitive data and actions go through `novori-admin`; membership, role, active account, and MFA are checked server-side. Ordinary accounts cannot read the new administration tables or invoke administration SQL.

## Features

- Report inbox: pending/reviewed/actioned/dismissed, context, decisions with reasons.
- Moderation: remove posts; tombstone comments while preserving replies; warn, suspend for 1/7/30 days, ban, restore access.
- Account support: profile, confirmation state, sign-in time, restriction and synchronization status. Private notes, passwords and tokens are excluded.
- Club tools: edit details/rules, pause/resume posting. Membership remains available.
- Announcements: draft, review, publish in-app system notifications, archive to stop outstanding delivery.
- API/cache monitoring: recorded upstream requests and sampled cache metadata. No provider calls or cache clearing.
- Audit: transactional decision history, optimistic revision checks, retry-safe request IDs.
- Report emails: queued minimal-content alerts through the existing Resend integration.

Owner can use all tools. Moderator can act on reports/readers. Support is read-only apart from its own email preference. There is no public admin signup. All roles require an authenticator app.

## Backend deployment

Project: `oanpmuiuuwljknwvyzev`. Existing report SQL 16/18 and account-deletion SQL 56 are prerequisites. Review/apply `supabase/migrations/20261005012000_novori_admin_hub.sql` in the project's SQL editor or your normal migration workflow. It is additive and safe to rerun; it does not replace report intake, deletion orchestration, provider RPCs or shared caches.

1. Apply the migration.
2. Set your verified main Auth user UUID in `admin/setup-owner.sql` and run it. Do not use a disposable test account.
3. Deploy the Edge Function from the repository root:

   ```sh
   npx supabase functions deploy novori-admin --project-ref oanpmuiuuwljknwvyzev --no-verify-jwt
   ```

   Gateway JWT checking is disabled to admit scheduled worker calls. The handler independently verifies user tokens with Supabase Auth, then checks membership, restrictions, active account and MFA. Worker calls require a separate strong secret; public keys alone never authorize an admin action.
4. Set `NOVORI_ADMIN_ORIGINS=https://admin.novori.link` on the function. Add an exact Pages preview origin only when testing, then remove it. Wildcards are not accepted.
5. Generate a random worker secret (e.g. `openssl rand -hex 32`), keep it private, and set `NOVORI_ADMIN_WORKER_SECRET` on the function. Add the identical value to Supabase Vault as `novori_admin_worker_secret`. Never place it in Cloudflare Pages or Git.
6. Existing `RESEND_API_KEY` enables report emails. Optional `NOVORI_ADMIN_ALERT_FROM` defaults to `Novori <noreply@novori.link>`; that sender must be verified. No report content or reporter identity is emailed.
7. Enable Cron, pg_net and Vault if needed; run `admin/setup-worker.sql`. The job processes queued account changes, announcements and email alerts every minute. Overview must show a recent successful heartbeat before launch.

Do not run a blanket `supabase db push` against this existing project without checking migration history; the original numbered SQL was applied manually. The migration deliberately fails if its foundation is missing.

## Cloudflare Pages deployment

Create a **separate** Pages project from `tmcmillin24/novori`. Leave the public `website/` project and mail DNS records untouched.

| Setting | Value |
| --- | --- |
| Production branch | `phase5-ask-readers` |
| Root directory | `admin` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment `NOVORI_SUPABASE_URL` | `https://oanpmuiuuwljknwvyzev.supabase.co` |
| Environment `NOVORI_SUPABASE_PUBLISHABLE_KEY` | Project's **public publishable key**, or legacy anon key |
| Custom domain | `admin.novori.link` |

Add the custom domain **inside Pages** so Cloudflare provisions the route and TLS. Do not point DNS at an arbitrary target. Secret/service-role keys are rejected by the frontend build. The site has a restrictive CSP, no external script CDN, no framing, no indexing, and no-store headers. An optional Cloudflare Access application restricted to the owner's email adds a website gate; Supabase authorization remains mandatory.

For additional administrator roles, use a trusted SQL session to insert/update `novori_admin_members` with a verified active Auth user UUID and role. Changing role/enabled takes effect on the next request. There is intentionally no browser owner-grant button.

## Validation

```sh
cd admin
npm ci
npm test
NOVORI_SUPABASE_PUBLISHABLE_KEY=sb_publishable_BUILD_TEST_ONLY npm run build
```

The test key is only for validating bundling; use the real project's public key in Cloudflare. Production builds fail when the public key is missing. `NOVORI_ADMIN_ALLOW_UNCONFIGURED=1` is available only for a connection-required build with no live data.

Tests execute the migration and moderation functions in PostgreSQL via PGlite and test the request handler separately. Live deployment still requires an end-to-end check against the real schema, Auth, Resend, Cron and Cloudflare.

## Launch checks

1. Visit the domain while signed out: only login is visible. A disposable non-admin account must be denied.
2. Sign in as the approved owner, enroll an authenticator, verify, and load each dashboard section. An `aal1` token must not read reports.
3. Submit a report using a disposable app account. Confirm its queue entry and report alert. Reporter identity is not exposed in the dashboard.
4. Warn a disposable account: verify its system notification and audit entry. Suspend it: confirm an already signed-in session cannot post and a new sign-in is blocked after Auth synchronization. Restore it and verify access returns.
5. Remove a reported test comment: its text/author disappear while another reader's child reply remains. Removing a post also removes its comments; the confirmation explicitly says so.
6. Pause a test club: posting fails, membership access remains. Resume and test posting again.
7. Save a draft without delivery. Publish a clearly labeled test announcement only when intentionally approved; publishing notifies active readers. Confirm progress, no duplicates, and recent worker heartbeat.
8. Re-test account deletion and restoration with a disposable account. Existing library/private-note/deletion behavior must remain correct. Shared caches must remain intact.

## Limits

Reader search is by username, clubs by name. Conversation context shows the first 100 comments. Club membership detail shows up to 100 members. Usage is Novori's recorded requests, not provider billing or quota guarantees; cache samples are the latest 100 entries. Announcements target active unrestricted readers during batch delivery; archived notifications already sent are retained. Support email is `support@novori.link`; confirm that mailbox is monitored before using reader notices. A ban is a restriction, not deletion of the reader's data.

## Google Books and Hardcover usage trackers

Apply `supabase/migrations/20261005034000_api_usage_trackers.sql` before deploying the updated Hardcover functions. It adds service-only daily counters and tracking timestamps; it preserves Google's quota accounting and all shared caches. Rerunning it preserves counts and the original enable date.

Deploy these five functions individually to project `oanpmuiuuwljknwvyzev`:

- `novori-admin` (retain `--no-verify-jwt`; authorization is performed by the handler)
- `hardcover-series`
- `hardcover-search-popularity`
- `hardcover-trending`
- `hardcover-recent-releases`

Use the existing deployment configuration for the four Hardcover functions. Cloudflare Pages rebuilds the admin frontend from the production branch. No mobile/native rebuild is needed.

API & cache shows Today, Last 7 days, and Last 30 days for both providers. Periods include the current UTC calendar day: seven days means today plus six earlier dates, and thirty means today plus twenty-nine earlier dates. The displayed refresh time is when the dashboard fetched its snapshot, not a continuously updating feed.

Google totals come from the existing `api_usage_daily` quota counter; its earliest retained day is labeled as an earliest recorded day, not an invented tracking start. Hardcover counts upstream attempts at the shared fetch boundary using an atomic service-only RPC. Cache hits and cooldown-blocked requests do not increment it; failed HTTP requests do. If the counter cannot be persisted, no uncounted Hardcover request is sent (existing stale-cache fallback remains available). The counter is reserved immediately before sending, so an interrupted execution may reserve a count without completing the network request. These are Novori records, not provider billing or historical lifetime totals.

Verify dashboard rows with `select usage_date,provider,upstream_requests from public.api_usage_daily order by usage_date desc;` for Google, and the same select from `public.novori_api_usage_daily` for Hardcover. Compare snapshots at the same time and UTC dates. A repeated warm cached request must not increase upstream counts. New uncached queries may make multiple requests, so do not assume one app action equals one provider request. Earlier unrecorded provider totals (including requests outside Novori) are not backfilled.

## ISBNdb and October 5 provider audit

ISBNdb's usage card reads the existing `novori_isbndb_usage_daily` counter created by the ISBNdb provider migration. No new SQL migration or cache reset is needed for this audit. Pull the production branch, then run `bash scripts/deploy-api-audit.sh` from the repository root. It explicitly sets `NOVORI_BOOK_PROVIDER=isbndb` and redeploys all seven provider-facing functions plus `novori-admin`, preserving admin's `--no-verify-jwt` configuration and server authorization. Existing ISBNdb/Hardcover secrets remain in place. Cloudflare Pages must build the current branch commit as well.

API & cache now displays provider configuration/key presence (never key values), backend audit version, exact UTC day bounds, all three usage cards, and cache record kinds. Google is labeled as a legacy quota counter; older cached artwork is retained. The shared JSON network boundary blocks Google Books API calls while ISBNdb is active. Inspect `docs/API_CACHE_AUDIT.md` for routing, cache limits, evidence, and the unresolved live Hardcover discrepancy. Run the read-only `admin/verify-api-usage.sql` to compare portal counts to database counts; compare before/after deltas with the provider websites at matching times. The 33-request difference is not automatically backfilled.

## Automated moderation and report priority

Deploy with `docs/MODERATION_SETUP.md`. The staged migration adds unpublished screening reviews, distinct-reporter priority, image removal/hash blocking, and content-free flag emails through the existing worker. Reports are ordered globally before pagination: three distinct open reporters gives High and five gives Urgent. This does not automatically delete content.

Flagged submissions require owner/moderator decisions with reasons and current row revisions. Approval allows exact-content resubmission under the reader's permissions; rejected items have an appeal approval path. Do not turn on enforcement before the media route, updated app, image backfill and live tests pass. See `docs/MODERATION_LAUNCH_PLAN.md` for coverage and remaining launch checks.
