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

## Apple Universal Links and future store fallback

In Cloudflare Pages build environment, `NOVORI_APPLE_TEAM_ID` generates
`/.well-known/apple-app-site-association` from the actual bundle ID in app.json.
The identifier must belong to the Apple team signing this app. No association is
published until the real Team ID is supplied. The native app also needs
`ios.associatedDomains: ["applinks:novori.link"]`, the Associated Domains
capability, and a new installed native build; JavaScript reloads cannot add it.

After Novori's listing is public, set `NOVORI_IOS_APP_STORE_URL` to its real
`https://apps.apple.com/.../id...` URL and redeploy. Shared pages on iOS then
offer the download link and redirect visible browser visitors there after 2.5
seconds; tapping Open in Novori or leaving the page cancels that redirect.
Before release the existing browser page remains available, with no fake store
link. This cannot reliably detect installation from JavaScript; iOS Universal
Links handle installed-app routing. Browser/user choices can still keep a link
on the web. Android verified App Links and Play Store fallback need their own
signing identity and listing setup.
