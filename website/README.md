# Novori public website

Static landing page, support page, and app-opening pages for shared books, posts,
and stacks. No API credentials, analytics, database access, or external book API
requests are used. Shared pages do not expose post content or private stack data.
Images use Novori's existing local branding asset.

## Cloudflare Pages

- Repository: `tmcmillin24/novori`
- Production branch: `phase5-ask-readers`
- Framework preset: None
- Root directory: `website`
- Build command: `node build.mjs`
- Build output directory: `dist`
- Environment variables: none

Build from the repository: `node website/build.mjs`.
Check link routing: `node --test website/share-links.test.mjs`.

Attach `novori.link` through the Pages project's Custom domains after deployment.
Preserve existing Cloudflare Email Routing and Resend DNS records. Optionally set
build watch paths to `website/*` and `assets/images/novori_appicon.png` so unrelated
app commits do not rebuild the website.

## Enabling app shares

Only after the domain and its routes are live, set the app's existing
`EXPO_PUBLIC_NOVORI_SHARE_BASE_URL=https://novori.link` and rebuild/reload the app
with that environment. Until then, the app's existing share behavior is unchanged.

`/book/:id`, `/post/:id`, and `/stack/:id` show a button to open the exact item
using the app's existing `novori://` scheme. A visitor needs Novori installed.
No App Store or TestFlight URL is invented. The browser pages do not fetch book
metadata or covers; item access and visibility are resolved by the existing app.

This is the browser fallback foundation, not automatic iOS Universal Links or
Android App Links. Those require verified Apple team/signing identifiers and
Android signing fingerprints, association files, and native app configuration.
Privacy/terms pages and corresponding Settings links remain separate follow-up
work; this deployment does not publish unreviewed policies.
