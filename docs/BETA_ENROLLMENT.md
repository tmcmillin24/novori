# Beta enrollment

Applies to the next 50 successfully created accounts after activation. Existing accounts are excluded. Accounts 1–15 enroll automatically; accounts 16–50 choose whether to enroll. Optional enrollment is unchecked by default. Declining consumes that account's rollout slot. Deleting an account does not reopen a slot. Accounts after 50 use normal signup.

Enrollment joins the private Novori Beta Testers club, follows the creator, and creates mutual follows with earlier enrolled testers who are still members and whose accounts are active and unrestricted. Blocked relationships are skipped. Testers can unfollow or leave; those relationships are never restored by enrollment. Earlier testers who have left the club are excluded from new connections.

The enrollment notice is shown before signup. Its version and optional choice are included in signup metadata. The database, not the client display, assigns the final slot under a row lock. Signup and enrollment commit or roll back together. An old app without the notice is denied during the campaign rather than silently enrolled.

## Installation

1. Pull the app update.
2. Run `supabase/migrations/20261007023000_beta_enrollment.sql` in Supabase SQL Editor. This installs the campaign disabled.
3. Reload the app, then run `supabase/enable-beta-enrollment.sql` in SQL Editor. Open Create Account again to load the notice.

No Edge Function deployment is required; the existing signup gateway already forwards the signup metadata. The club and creator IDs were verified against the supplied live schema.

## Verification

Create a disposable new account. Confirm the notice appears, the account joins the club, and it follows the creator. Inspect the campaign with:

```sql
select allocated,enabled,activated_at from public.novori_beta_campaign;
select slot,user_id,enrolled,created_at from public.novori_beta_accounts order by slot;
```

Unfollow the creator and leave the club. Sign out and back in; neither action should be undone. Deleting the test account still consumes its original slot. Testing therefore uses a real campaign slot. Do not reset the counter to recover test slots.

Disable new enrollment without changing existing memberships or follows:

```sql
update public.novori_beta_campaign set enabled=false where id;
```

## Validation

`node --test admin/tests/beta-enrollment.test.mjs` checks allocation, cutoff, rollback, privacy of campaign tables, deletion, blocked links, leave/unfollow persistence, repeated installation and beta club deletion. Signup UI tests cover notice visibility and the optional choice. Live signup still needs verification after installation.
