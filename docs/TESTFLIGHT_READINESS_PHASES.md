# TestFlight readiness phases

Updated October 7, 2026. Phase 1 starts from release candidate `25c2f70290e6bac493b2dae2e2b6be68be5440fb` on `phase5-ask-readers`.

## Phase 1 — Regression baseline and confirmed defects: complete and published

- Updated outdated test mocks for window dimensions, keyboard visibility, spoiler controls, feed mutation hooks, and valid server-secret configuration.
- Updated publication tests to exercise moderated reading-update publishing and the atomic stack submission API. Missing moderated publishers fail closed; tests no longer expect an unmoderated fallback or separate stack/post writes.
- Fixed a confirmed comment counting defect: a successful comment is inserted with its server ID and counted once. A lagging immediate read preserves that confirmed comment; failed saves retain the editable draft after the request finishes. Pending content waits for server confirmation before appearing in the thread.
- Fixed the privacy settings screen's incomplete update payload. Profile privacy and review toggles preserve each stored book visibility setting; the Library Books switch deliberately changes all categories. Server switches are disabled during a pending write or if existing preferences could not load. Failed writes restore the displayed state.
- Fixed nullable owned-book status labels, guarded reading-date edits without a reading status, correctly narrowed iOS-only tablet access, checked optional media URLs before prefetch, corrected tab-button ref typing, retained reader book types through cover mapping, and added precise types for parsed sticker values and stack author validation.
- Scoped Expo app and typed Jest checks separately from standalone Deno endpoints. Shared helpers' Supabase URL imports use the installed SDK's actual types, not `any` stubs. CSS module declarations support the existing web component. Added `npm run typecheck` to run both app and typed-test checks.

### Validation

- Full Jest: **80 suites, 863 tests pass**, up from 71 passing suites and 804 passing tests in the audit.
- `npm run typecheck`: app and typed-test checks pass.
- Website: **17 tests pass**.
- `npm run licenses:check`: **726 notices verified**.
- `npx expo export --platform ios`: JavaScript/Hermes export succeeds.
- `git diff --check`: passes.

Book provider requests, cache TTLs/keys, canonical artwork ranking, and the existing cached-opening implementation were not changed by Phase 1. No backend migration/function deployment or public website deployment was performed. The Hermes export is not a signed IPA. Standalone Deno endpoint checking and deployed database validation are not certified by the Expo type check; Deno is not installed in this workspace. Local regression success does not replace live device checks.

## Phase 2 — Compatible dependency security fixes: complete with open dispositions

Updated the six Expo SDK 57 patch recommendations; patched shell-quote, scoped Xcode's uuid, and sharp. Added the upstream decode-uri-component 0.5.0 fix with a minimal CommonJS export adaptation for Expo Router's query-string 7. Preserved the original source and MIT license and regenerated the shared app/website inventory. See [dependency security dispositions](DEPENDENCY_SECURITY.md) for package versions, reachability, remaining advisories and follow-up.

### Validation

- Clean `npm ci`: passes with the final lockfile and local decoder package.
- Full Jest: **81 suites, 872 tests pass**, including URL compatibility, malformed percent input, shell quoting and Xcode identifier generation.
- `npm run typecheck`: app and typed-test checks pass.
- Website: **17 tests pass**; public website production build succeeds, including updated legal/license pages and sharp processing.
- `npm run licenses:check`: **729 notices verified**.
- iOS and Android production JavaScript/Hermes exports: pass. These are bundle checks, not signed native builds.
- App web static export: blocked by `ReferenceError: window is not defined` in AsyncStorage during Supabase auth session initialization with nonproduction build placeholders. Reproduced the same failure at the previous commit with the previous installed dependency set; it predates Phase 2. The separate public website build passes. App web support is not certified by these checks.
- Production npm audit: **44 → 31 affected packages**, critical **1 → 0**. Full audit: **54 affected packages**, no critical findings. Three distinct upstream advisories remain open (braces, node-forge, sprintf-js), with no published fixes at review.
- Installed Expo SDK offline dependency check reports dependencies up to date; online validation timed out through the environment proxy. Offline validation does not certify current remote recommendations.

Native Expo patches require a new development client/IPA after pulling and `npm ci`. Book cache keys/TTLs, cover selection and provider request logic were not changed. This phase does not certify deployed backend behavior, device layouts, signing or legal/provider rights. Remaining signing-tool risk must be reviewed before TestFlight clearance.

## Remaining phases

| Phase | Work | Completion evidence |
| --- | --- | --- |
| 3 — Cached covers/loading | Persist/reuse confirmed selections safely, bound the selection cache, deduplicate forced refreshes. | Restart/offline/rapid navigation tests; identical artwork across surfaces; measured upstream counters. |
| 4 — Legal/disclosures | ISBNdb acknowledgment parity; provider usage/cache/artwork/export rights; ownership and native notice reconciliation. | Applicable agreements documented and disclosures reflect actual usage. |
| 5 — Live backend | Moderation/reporting/blocking/media revocation; deactivation/restoration/immediate and scheduled deletion; installed RLS/RPC review. | Deployed test-account verification and operational support/safety evidence. |
| 6 — Devices | Smaller iPhone and iPad portrait/landscape/split view; orbit, descriptions, keyboard, accessibility sizing, covers. | Release-build device matrix passes. |
| 7 — TestFlight | Apple enrollment, final identifiers, signing/configuration, native privacy declarations/notices, beta review metadata/account. | Signed build uploads and testers can install it. |

Apple enrollment can proceed alongside these phases. Feed seeding is separate and can follow launch readiness. Do not interpret Phase 1 completion as complete legal, security, or TestFlight clearance.
