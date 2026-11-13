# Phone notifications rollout

The inbox remains the source of truth. A new notifications INSERT queues one delivery per enabled installation. Existing social/club generation, daily reminder times, weekly/monthly recap eligibility and reminder opt-outs are unchanged. There is no backfill of old alerts and no book provider, cover, catalog or cache changes.

## One-time backend setup

Use a scoped Supabase CLI access token for the Novori project with Project Read, Database Read/write, Edge Functions Read/write, and Edge Function Secrets Read/write. The last permission is necessary to install the private delivery-worker credential. Never paste the token into a chat or repository.

From the Mac terminal:

```bash
(
  set -e
  cd /Users/tristanmcmillin/Developer/Novori
  git switch beta-updates
  git pull --ff-only origin beta-updates
  npm ci
  printf 'Copy your Supabase CLI key, then press Enter: '
  read -r NOVORI_CONTINUE </dev/tty
  export SUPABASE_ACCESS_TOKEN="$(pbpaste | tr -d '\r\n')"
  node scripts/deploy-phone-push.mjs
)
```

The helper applies only the additive push SQL, installs the private worker secret in Edge secrets and Vault, deploys only `phone-push`, and schedules `novori-phone-push` every minute. It prints the existing reminder cron state too. If `novori-reading-reminders` is absent or inactive, the existing reminder generator needs restoring before scheduled recap/reminder pushes can work. Do not generate a second schedule for the same reminders. Rerunning the helper preserves registrations and reuses the worker credential. Existing notifications aren't enqueued again.

Supabase Vault must be enabled (standard hosted project feature). `pg_cron` and `pg_net` are enabled by the helper. No database password is required. An Edge-secret permission failure is not an app error: update the scoped CLI token and rerun the helper. Deployment is not a new backup; keep the existing backup workflow before rollout if a fresh recovery snapshot is wanted.

## Apple credentials and native rebuild

`app.config.ts` merges the local `app.json`, preserving EAS ownership, project UUID, bundle identifier, orientation and other plugins. It adds the notifications plugin. Preserve local production configuration; do not reset `app.json`.

Confirm the resolved iOS bundle identifier is `link.novori.app` and EAS project UUID is `30e6f9f0-79ba-4420-9217-433fa022e460`:

```bash
npx expo config --type public
npx eas-cli@latest credentials --platform ios
```

Select the production profile, then the Apple Push Notifications key option. Reuse the team's existing valid APNs key if offered; otherwise generate one. This is separate from the distribution certificate and App Store Connect submission API key. EAS needs Apple-team access to configure the push entitlement/key. If Expo enhanced push security is enabled, also set `EXPO_PUSH_ACCESS_TOKEN` in Supabase Edge secrets to a valid Expo access token; this is not the Supabase CLI token. The default Expo push service does not require this optional token.

Test on the phone before release. The currently installed development binary has no notifications native module. Generate updated native files without deleting local signing configuration:

```bash
npx expo prebuild --platform ios
npx expo run:ios --device --port 8082
```

If local Xcode signing prompts, use team HMZHK4G79V and bundle `link.novori.app`. A production build does not depend on the Metro port.

After the device tests below pass:

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production --latest
```

Choose the newly completed build if more than one build is running. Wait for Apple processing, then assign it to the Novori Beta TestFlight group and enable tester notifications. Apple may require beta review for the new external build. Existing testers can continue using the current build until they update.

Android code creates the `novori` channel and requests permission, but remote delivery additionally requires an Android app build and the matching Firebase FCM v1 credentials uploaded to EAS. This rollout does not invent or provision a Firebase project. Test Android separately before claiming Android delivery is operational. Web continues to use the inbox and does not request native permission.

## Device acceptance tests (required before release)

1. Sign in on the rebuilt physical iPhone. Enable notifications in the explanation prompt or Novori Settings → Notifications. iPhone Settings → Apps → Novori should now expose notification settings after the permission request.
2. Tap **Send me a test notification**, then lock/background the phone. It should arrive after the next worker run (usually within a minute). Tap it; it opens the inbox. Also test foreground banners and a cold start after terminating the app.
3. Test a real follow/reply and a club event; taps must open the same destination as their inbox rows. Recap taps open the correct weekly/monthly reference date. The existing generator determines when these become ready; don't send fake recaps to every tester.
4. Turn off an activity/reminder category, and mute one club. New matching updates must not produce phone pushes. Re-enable and test again. Already delivered OS notifications cannot be recalled by changing preferences.
5. Deny permission, return to settings, use **Open phone settings**, enable it there and return to Novori. Registration should recover without reinstalling.
6. Sign out, then sign into a different account on the same phone. No new old-account pushes may be routed/displayed in the foreground; the server rotates registration generation and drops queued old-account jobs. Test a second device too. Logout needs a network connection to revoke the remote token; OS notifications already delivered may remain in Notification Center.
7. Revisit book pages and series and verify their covers remain unchanged. Push registration/delivery contains no catalog calls.

OS Focus settings, notification permission, connectivity and APNs availability affect delivery. No implementation guarantees that every alert appears immediately. Expo receipts confirm handoff to Apple/Google, not that a person saw the banner.

## Delivery diagnostics and controls

Edge function `phone-push` logs sanitized counts only: claimed, tickets, receipts, failed, retried, skipped, uncertain. Tickets are acceptance by Expo; receipts are checked after 15 minutes. `delivered` means a successful Expo receipt / provider handoff, not verified on-screen delivery. Retired-device responses disable only the matching registration generation.

In the Supabase SQL editor (admin only):

```sql
select state, error_code, count(*), max(updated_at) as latest
from public.novori_push_outbox group by state,error_code order by latest desc;
select jobname, active, schedule from cron.job
where jobname in ('novori-phone-push','novori-reading-reminders');
```

429/5xx responses retry with backoff; ambiguous send timeouts are recorded as `uncertain` rather than resent blindly. Worker leases prevent overlapping cron runs from claiming the same delivery. Tokens and queues are service-only, with no client table access. Registration requires an authenticated active account; unregister after logout requires the device's random installation proof. Responses contain only notification/recipient IDs and are resolved from authorized inbox rows, never arbitrary incoming URLs. Lock-screen activity uses structured templates with the actor display name for follows, comments, replies and likes. Comment/review text is never included. Comment votes never expose actor identity. Both post and comment vote previews are anonymous. Other activity uses the inbox title as its wording source; notification bodies containing user text are never copied. Only explicit positive votes queue; downvotes and unknown directions do not. Vote alerts wait 15 seconds, coalesce by target in fixed 15-minute windows, and do not resend within a window after dispatch. Recap messages identify weekly/monthly readiness.

Delivery handles up to 25 queued jobs per invocation with five concurrent Expo requests. Large bursts may take multiple cron ticks; this is intentionally bounded for the Edge runtime. Final delivery records expire after 30 days. No stale completed records or entire notification histories are downloaded to the device.

Pause new phone delivery without changing the inbox/reminder system:

```sql
select cron.unschedule(jobid) from cron.job where jobname='novori-phone-push';
```

Resume by rerunning the helper. Do not drop the inbox, reminder preferences or book tables. Old pending alerts older than one day are skipped, not sent as a backlog. Local automated tests do not replace the physical-device credential and APNs tests above.

## Preview-only update

After pulling beta-updates, run `node scripts/deploy-push-previews.mjs` with the CLI token exported to apply only the preview/batching migration. This does not recreate credentials, deploy a worker or change the active cron schedule. No native rebuild is required for phone notification text. Use a fresh event after deployment; upvotes intentionally wait longer than comments.

## Immediate delivery, yearly recaps, and anonymous vote inbox rows

Run `node scripts/deploy-notification-delivery.mjs` after pulling and exporting the CLI token. This database-only rollout preserves the worker secret and deployment, verifies the existing schedules and year-summary RPC, installs the latest preview rules, and prints all three active schedules. No provider/catalog/cover functions are touched.

An AFTER INSERT statement trigger on the private outbox wakes the existing Edge worker using pg_net after commit. It shares one wake per one-second burst; delayed upvotes do not wake early. Queue/network failures do not fail the user's post/comment/follow. The every-minute worker remains the retry and burst/backlog fallback. Normal eligible alerts can usually arrive within seconds, but no OS delivery-time guarantee is made. The existing token generation, preference, block/mute, receipt and lease checks remain authoritative.

The existing daily/weekly/monthly reminder generator now checks every minute instead of every 15 minutes, without changing its command, local 6 p.m. due time, duplicate suppression or eligibility rules. A daily check-in completed after reminder creation is checked again before phone dispatch. The yearly generator runs only for users due on January 1 at 6 p.m. local, inspects the completed year's existing private summary once, and queues one recap only if finished books or reading days are recorded. No book provider calls or cover resolution occur. Annual evaluation is deduplicated independently of inbox deletion. No-activity users get no empty recap alert.

A new Yearly Recap preference initially inherits existing Monthly Recap opt-outs; new readers default on. Turning it off cancels pending annual notices; re-enabling does not backdate opt-in. Existing default/opt-out and timezone sync remain in the old sync RPC; the new authenticated wrapper returns the complete preference row. Annual notifications open /reading-recaps in year mode with December 31 of the completed year as reference date.

New client code masks voter names, usernames, avatars, bodies and navigable actors before hydration/rendering in the inbox. Underlying event actor IDs remain stored server-side for existing vote, deduplication and block rules. This is presentation anonymity; this rollout does not change the legacy notifications table's API grants. Phone vote alerts are anonymous in the backend too, and downvotes have no phone alert. Update the app build for TestFlight users to get inbox masking and the Yearly Recap toggle/year routing; development needs only a JS refresh.

Verify live social delivery on a locked physical phone, anonymous post and comment votes, daily skip-after-check-in, and yearly toggle persistence before release. Automated PostgreSQL tests simulate annual eligibility/timezones and network queue failure; they do not fast-forward the live production calendar or prove APNs latency. Existing pre-year-support builds can receive annual alerts but cannot route them to year mode until updated.

Vote batches now become eligible after 15 seconds. A five-second database-only due check wakes the Edge worker only when a batch is ready, avoiding a further minute of polling delay and avoiding empty Edge invocations. The minute retry worker remains unchanged. Expected batching plus polling is about 15–20 seconds before network/OS delivery. The fixed 15-minute per-target anti-spam window and anonymity remain unchanged. Existing unsent batches are shortened; dispatched batches are not replayed.

## Badge refresh recovery

Home uses one account-bound realtime coordinator for its attention count. Realtime bursts coalesce, cancelled/background reads cannot update the screen, temporary transport/auth failures retry up to three times with backoff, and foreground/reconnect starts a fresh read. Failure retains the prior count and does not raise a development error overlay. Count-only reads use cached session identity and database RLS rather than hitting /auth/user on every event; identity is checked again before applying the result. Account changes dispose the old coordinator/channel and clear its count. No push delivery, book metadata, cover, provider or database policy changes are involved.
