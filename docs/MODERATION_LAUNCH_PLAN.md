# Novori moderation implementation and launch checks

Prepared October 5, 2026. Local code/tests are distinct from live deployment and store acceptance. Use `MODERATION_SETUP.md` for the rollout; enforcement is staged off.

## Publication boundary

The native Supabase transport forwards supported user-content writes to `ugc-publish`. The gateway verifies the reader through Auth, checks deactivation/suspension and current 18+/terms acceptance, applies quotas, screens only selected shared fields, and forwards approved requests with the **reader JWT**. Existing RLS/RPC authorization remains in force. Credentials/private reading notes are excluded from moderation inputs.

A short-lived service-only ticket binds publication to the verified reader and PostgREST request path. Database triggers reject unauthenticated or older-client attempts to alter shared fields without that ticket after activation. Approval-cache keys bind user-visible content, target IDs and filters. The native client never receives the ticket. Ordinary private note/status updates and catalog reads keep their existing direct transport.

Signup names use a separate gateway and a one-use receipt bound to the exact email/profile names. The Auth trigger consumes/removes the receipt before storing user metadata; passwords go only to Auth. Metadata name changes cannot bypass the profile editor after activation. Existing email/password signup remains the supported flow; test any future OAuth/provider flow before adding it.

| Known content surface | Fields screened/enforced |
| --- | --- |
| Feed posts, Ask Readers, review posts | Body, user image reference, shared book labels |
| Comments/replies and edits | Comment body |
| Profiles/signup | Username, display name, biography, user avatar |
| Library reviews | Review text; selected book labels stored for public presentation |
| Stacks | Name/description and item titles/authors |
| Clubs | Name, description, rules, user cover |
| Discussions/polls | Title, prompt, options, spoiler label, shared book reference |
| Club events | Title, description, location, meeting URL, shared book reference |
| Shared club reads | Shared note and book reference |
| Reading updates/recaps | Published body/caption and public snapshot; private note body excluded |

The guard exempts the existing comment-removal, account-deactivation and restoration RPC paths, which only remove/mask or restore previously published material. The installed legacy SQL function bodies are not fully represented in the repository. Inspect the read-only verification output and run lifecycle/blocking tests against the installed database before launch. Unknown shared writes to guarded tables fail closed rather than receiving a bypass ticket.

Catalog artwork retains its original provider paths/resolution. Known catalog image hosts are allowed; new hosts require an explicit server configuration decision. Reader photographs use the registry and screening path. This changes neither ISBNdb/Hardcover routing nor book-cache expiry/cover selection.

## Scanner decisions and review

`omni-moderation-latest` screens supported text/image categories before a new submission is forwarded or an image is uploaded for public delivery. A flag holds publication and creates a private queue entry. Missing configuration, timeout, malformed category output and provider outage deny publication. All documented categories must be present as booleans; an empty or partial result is not an approval. Reader profanity preferences remain a separate display setting.

Admin → Flagged submissions is role/MFA protected. Owners/moderators approve resubmission or reject with a reason. Review checks the current row revision, records an audit decision and notifies the reader with an appeal contact. A previously rejected item can be approved after an appeal. Approval does not execute an old request with elevated permissions: the reader submits the same content again, under current permissions. Edits receive different content keys; unchanged approval receipts expire after seven days.

Images are JPEG/PNG/WebP, bounded to 8 MB, and assigned immutable owner paths. Flagged images are in a private quarantine bucket and are revealed deliberately by an operator; they do not automatically render in the dashboard. Human image rejection/removal stores a per-reader hash denylist, so another filename does not bypass the decision. Approval after an appeal can clear the hash block. An AI flag is not an automatic ban.

The existing admin worker can send content-free flag emails through the existing Resend configuration. Alerts are leased, retryable, idempotent and sent only to enabled opted-in admins. Cloudflare's daily scanner emails are a separate channel; there is no claimed webhook importing them automatically into Novori.

Literary context can cause false positives. Review representative romance, thriller, recovery and violence-related book discussions before broad release and keep legitimate appeals usable. Never describe image categories as covered when the provider documents them as text-only. Do not submit known/suspected CSAM to the general moderation endpoint.

## Image delivery and Cloudflare

Approved/registered media is served through `media.novori.link`, a Worker bound to the novori.link zone. The private Supabase origin requires a server secret and denies missing, blocked, deactivated or suspended owners. Cached image bytes are re-authorized on hits; removal cannot be overridden by an old edge cache entry. The app resolves legacy media URLs at render time, including saved local feed data. A device that already downloaded content cannot be retroactively erased.

The rollout makes avatars, post-media, club-covers and moderation-quarantine private through the Storage API before activating guards. Database/Storage guards forbid direct user uploads/overwrites, and a restrictive SELECT policy stops authenticated raw download/signing from bypassing the protected route; server uploads remain possible only through the authenticated screening gateway. Existing user assets are screened by a resumable operator migration. Flagged legacy assets are blocked on the protected route and can be reviewed; this does not certify old shared text.

The account-deletion worker removes registered service-created assets and quarantine copies before deleting Auth, in addition to the existing cleanup. Storage failures leave deletion retryable.

Cloudflare's free CSAM tool hashes images entering cache against known material and attempts to block matches, with daily notifications. It is not comprehensive new-material classification, a synchronous upload approval API, or guaranteed first-display prevention. The Worker uses the zone Cache API; coverage for this deployed route requires Cloudflare confirmation. No live account setting, provider key, route or scanner result was verified in this local implementation. See the setup guide's authoritative links.

## Reports and priority

The database view sorts the entire report queue before pagination. Counts include distinct reporters with pending/reviewed reports for a target: three gives High, five gives Urgent. Repeated submissions by the same reader count once. Supported child-safety/threat reason codes are urgent if the installed intake accepts them; the existing app reason menu has not been expanded to claim new codes.

Escalation prompts operator review, not automatic deletion or suspension. Removal/restriction remains an authorized action with an audit reason. Reported photos/profile images can be removed independently, and removed photo posts revoke asset delivery. Existing post/comment/profile report intake and account suspension tools are retained.

## Required live launch checks

- Verify report delivery, flags, approvals/rejections, emails, current terms, direct-write bypass denial and image-origin bypass denial in the deployed build.
- Verify every listed creation/edit route, full-thread/profile/notification views, blocked interactions, suspension from an existing JWT, restoration and permanent deletion.
- Inspect the installed legacy SQL/RLS and any additional shared tables/RPCs against the gateway contract. Local fixtures cannot certify missing installed definitions.
- Review existing shared text. Ensure library reviews, stacks, clubs, events and shared notes have a tested report/support route and an operator removal process. Current in-app report target types are posts/comments/profiles. Check mirrored review copies and copied notification previews when removing content.
- Confirm the Cloudflare zone setting, monitored notification email and Worker-route scanning coverage. Cache hits prove caching only.
- Check queues at least twice daily, prioritize urgent safety matters, handle appeals and follow the published child-safety response procedure.
- Provide exact report/block instructions and a working non-admin reviewer account in the stores' private access fields. Keep admin credentials and service secrets out of reviewer access.

Automated tests prove the implemented boundaries and modeled behavior. They do not establish a live moderation SLA, all legacy RLS behavior, comprehensive harmful-image detection, or guaranteed App Store/Play approval.
