# October beta update batch

Branch: `beta-updates`. Starting code: `5688db64a5fa54dafb761ebc6bc023585ee2326e`.
Rollback branch: `baseline/testflight-2026-10-15`. The Git rollback is code only, not a database restore.

## Changes

- Reader profile options wait for native iOS modal dismissal before presenting Report Reader (and the other follow-up actions). Android dispatches once the source menu is hidden. Existing report RPC and moderation reasons remain in use.
- Club post cards and their explicit comment controls open the existing `/post/[id]` conversation, including announcements. The same detail screen enforces membership and spoiler visibility. Comments already mark the post mutation version, so returning refreshes the conversation counts through the existing club loader.
- Club discussion cards keep their attachment heading and omit the redundant outer badge. The author header now has bottom spacing.
- Own Profile > Reviews uses the owner's already-loaded library ratings/reviews, even with public reviews disabled. Eye/eye-off and text show Public, Followers only, or Private according to existing profile privacy. No public-reader RPC, RLS or privacy preference is relaxed; independently shared review posts are not made private by hiding library reviews.
- Book detail has Report Book Cover with wrong/blurry/missing choices and a pending state. Failures leave the form open and never announce success. Report submission does not fetch providers, select covers, rewrite metadata, invalidate caches or perform repairs.
- Separate admin Book Artwork section groups by catalog `work_id`, with one row per reader per catalog work (including editions linked to that work). A repeat pending report updates its reason/image without increasing the count. A report after resolution reopens the existing group. Separately catalogued works are not merged merely because their titles match.
- Admins can mark pending reports resolved/dismissed with a recorded reason. A group revision prevents an out-of-date review from closing newly changed reports. Decisions are idempotent and audited. These actions do not repair covers.

## Backend preparation — not deployed

The existing live TestFlight app continues to use its current backend. No production SQL, functions, admin website deployment, native build or EAS update was performed for this batch.

New book report intake requires `supabase/migrations/20261016010000_book_artwork_reports.sql` on the **test database** before testing submissions. It adds a report table, grouped service-only view, authenticated intake RPC and service-only admin decision RPC. Ordinary accounts cannot read the table/queue or resolve reports. Signed-in active unrestricted accounts can report existing catalog identities, with a limit of 20 new distinct books per day. Repeated submissions of the same work do not add queue entries.

The admin test backend also needs the updated `novori-admin` function and matching admin frontend. Point both the development app and admin frontend at that test project using their existing environment configuration. The new admin navigation deliberately fails visibly if its database foundation is absent; it does not fall back to production. Do not point the new frontend at the production admin function until the coordinated backend deployment is ready.

Use an isolated Supabase test project or a fully initialized local backend for this end-to-end check. The local PGlite migration tests validate SQL behavior but do not create that full environment. The historical project foundation includes manually applied SQL, so do not assume replaying the repository's newer migrations alone initializes a blank project.

The other four app changes use existing backend contracts and can be checked in the development client without deploying the new report migration. Book report submission will show an explicit unavailable message until the RPC is installed. It does not silently simulate successful submission.

## Phone testing

On the Mac, with `beta-updates` checked out:

```sh
cd /Users/tristanmcmillin/Developer/Novori
git pull --ff-only origin beta-updates
npx expo start --dev-client --port 8082
```

Open the existing development client, not the TestFlight installation. No new native dependency was added.

1. Another reader's profile: options > Report Reader; choose a reason, verify submission acknowledgement and admin receipt. Cancel and repeat. Also verify block/invite menus still open after the source closes. Test iPhone, Android if available, and an iPad in both orientations.
2. Club Posts: tap announcement body and Comments; enter the normal conversation, add a comment, return and verify its count. Repeat with a discussion, pinned post and spoiler discussion. Author, share, book, vote and pin controls should retain their own actions.
3. Club discussion card: one BOOK DISCUSSION heading, separated from the avatar/header; no empty badge gap. Inspect small iPhone and iPad sizes.
4. Own Profile > Reviews: with Show Reviews Publicly off, ratings/reviews remain visible to the owner with Private/eye-off. Turn it on: Public/eye, or Followers only/eye-off for private accounts. Check from another account that hidden reviews remain hidden.
5. On the test backend, report different editions of one book from multiple accounts. Admin Book Artwork should show one book and the distinct reader count. Repeat from one account; the count must not increase. Resolve, report again, and verify the same group reopens. Verify report actions never change covers or book details.

## Validation

- App TypeScript checks passed.
- All 110 app Jest suites passed: 1,125 tests.
- Admin Node suite passed: 92 tests, including five PGlite database tests for report permissions, linked-edition grouping, idempotency, stale reviews and metadata preservation, plus grouped UI/handler tests.
- iOS and Android JavaScript exports passed.
- Admin bundle compiled in explicitly unconfigured mode (no live credentials or deployment).

These are source/bundle/database checks, not a claim that the modified UI was exercised on a physical device. Complete the phone and test-backend checks before the next TestFlight submission. The saved database export has not been restore-tested and does not cover Storage object bytes or all project configuration.

## Approved release procedure

The owner approved the phone-tested app changes for release. The tested code checkpoint is also saved at GitHub branch `baseline/beta-approved-2026-10-15` (`cb9da8c`).

1. Before deployment, take a new timestamped database export on the owner's Mac. Keep roles/schema/data together outside Git, record the Git commit, and copy local `app.json`, `eas.json` and the iOS project signing configuration into that private backup directory. Check that the three SQL exports are nonempty. This is not a verified full-project restore or a backup of Storage object bytes.
2. From updated `beta-updates`, run `node scripts/deploy-book-artwork-reports.mjs` with the project-scoped CLI token in `SUPABASE_ACCESS_TOKEN`. Database Read-write and Edge Functions Read-write are needed in addition to the existing backup/link permissions. The helper checks access before migration, applies only this batch's new migration, verifies the foundation, asks PostgREST to reload its schema, and deploys only `novori-admin` with its established `--no-verify-jwt` setting. Partial foundations fail closed. Retrying skips a completed migration. It never deploys provider/catalog functions.
3. After the backend deployment succeeds, fast-forward `phase5-ask-readers` to the approved `beta-updates` head. Cloudflare Pages' admin project is configured to build that production branch. Confirm the Pages deployment is successful and check Book Artwork while signed in.
4. On the Mac, retain the local EAS/app config and native signing changes. Switch to the updated production branch, then use the existing production EAS build with auto-submit. Uploading a binary does not by itself guarantee availability to the external group: select the processed build for Novori Beta and submit for beta review if Apple requests it.
5. From the development client, submit a cover report and confirm its grouped admin entry before distributing the new mobile build. Mark it resolved/dismissed with a reason to verify the decision path. Existing testers can stay on the prior build while the next build is processed/reviewed.

The deployment helper has three additional tests for targeted function deployment, safe retries/partial-state rejection, permission failures before SQL, and no false deployment-success message. Those tests use fake transport/processes and do not deploy anything.
