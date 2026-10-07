# Dependency security — Phase 2

Reviewed October 7, 2026 against the npm lockfile, starting at `f64d27ddcb72f65365b056ead682ea1526c876a6`. This records compatible repairs and outstanding dispositions, not a vulnerability-free certification.

## Repairs

| Dependency | Installed repair | Reason and compatibility |
| --- | --- | --- |
| shell-quote | 1.12.0 override | Fixes critical [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv); CommonJS quoting API retained. Regression checks reject a newline injection after a comment token. |
| decode-uri-component | 0.5.0, local CommonJS adaptation | Fixes malformed-input denial of service [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr). Expo Router uses query-string 7, which requires a callable CommonJS export; upstream 0.5.0 is ESM. Only the export declaration changes; the original algorithm and MIT license are retained in `vendor/decode-uri-component`. Tests verify source equivalence, import identity, malformed input and normal URL/query round trips. |
| uuid under xcode | 11.1.1 scoped override | Fixes [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Xcode calls v4 rather than the affected v3/v5/v6 APIs. The compatible CommonJS Node entry and 24-character Xcode identifier format are checked in an actual Node subprocess. |
| sharp | 0.35.5 | Fixes SVG-processing advisory [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) in development/website image tooling. Website build validates the updated native package. |
| Expo SDK 57 packages | @expo/ui 57.0.22; expo 57.0.27; expo-constants 57.0.21; expo-image-manipulator 57.0.21; expo-linking 57.0.12; expo-router 57.0.25 | Applies SDK-recommended patches and their compatible transitive updates. React, React Native, Reanimated, worklets and Supabase versions are unchanged. |

The decoder is a root file dependency referenced by npm's `$decode-uri-component` override. `.npmrc` uses `install-links=true` so clean installs pack the vendored package rather than leave a mutable filesystem link. Keep its upstream source and license when updating it. Remove this adaptation once Expo Router supports a fixed decoder's module format.

## Outstanding advisories

`npm audit --omit=dev` changed from **44 affected packages (1 critical, 27 high, 16 moderate)** to **31 (0 critical, 26 high, 5 moderate)**. The full audit now reports **54 (0 critical, 49 high, 5 moderate)**. Counts include dependent packages affected by the same underlying advisory; these are three distinct remaining advisories, not 31 distinct defects. npm's production classification includes build tools installed through Expo/React Native dependencies and is not proof of mobile runtime reachability.

| Advisory | Observed path and risk | Disposition and follow-up |
| --- | --- | --- |
| [braces GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), high, installed 3.0.3 | File/glob tooling through micromatch and Metro/Jest; deeply nested attacker-controlled patterns can exhaust the stack. No app book/provider/cache import was found. | Open: no published fixed version at review. Keep build/test configuration trusted and do not add user-supplied glob patterns. Recheck upstream before the release candidate; update within the supported SDK when patched. |
| [node-forge GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), high, installed 1.4.0 | Expo CLI and @expo/code-signing-certificates. Certificate, public-key and CSR verification calls are present; this is a real signing-tool risk, even though no book/runtime import was found. | Open: no published fixed version at review. Use trusted certificate inputs; review the actual native/update signing workflow in Phase 7 and recheck upstream before signing. Trusted inputs are exposure reduction, not a cryptographic fix. |
| [sprintf-js GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), moderate, installed 1.0.3 | Babel/Istanbul configuration tooling → js-yaml 3.15.2 → argparse 1.0.10. Unbounded precision in attacker-controlled format strings can exhaust resources; reader descriptions are not passed to this API by the app. | Open: no published fixed version at review. Keep formatter/configuration inputs trusted. Recheck upstream before the release candidate and upgrade the parent tool within Expo compatibility when possible. |

Do not run `npm audit fix --force`: current suggestions include Expo 44, React Native 0.72, Jest 30 or jest-expo 58, outside this SDK 57 dependency set. Remaining highs require explicit review before TestFlight clearance; this phase's completion means compatible fixes plus recorded dispositions. It does not close Phase 7's signing review.

## Verification and deployment

- Clean `npm ci` succeeds with the final lockfile and vendored decoder.
- Full app/Jest checks, app and typed-test TypeScript checks, website checks and build, platform bundle exports, and license checks are recorded in `TESTFLIGHT_READINESS_PHASES.md`.
- The online Expo dependency check timed out through the environment proxy. The installed SDK's offline check reports dependencies up to date, with its warning that offline validation is less reliable.
- iOS and Android production JavaScript/Hermes exports pass. App web static export, using explicit nonproduction Supabase placeholders, fails because AsyncStorage accesses `window` during Supabase auth initialization in server rendering. The same error was reproduced at `f64d27d` using the previous installed dependency set (Expo 57.0.26), confirming it predates these changes. This remains an open app-web readiness finding; the separate public website builds successfully. Neither check verifies a live backend configuration.
- Native Expo packages changed: rebuild the development client/IPA after pulling and installing. An existing native binary plus a Metro reload is not the release validation for these patches.
- No cache keys/TTLs, provider request routes, cover selection logic, backend functions/migrations or credentials were changed. No signed IPA or manual website deployment is included. Device checks and deployed backend checks remain in later phases.

Reproduction: `npm ci`, `npm audit --omit=dev`, `npm audit`, `npm test -- --runInBand`, `npm run typecheck`, `npm run licenses:check`, `npm test --prefix website`, `npm run build --prefix website`. Audit commands still return a nonzero status because the documented advisories remain open.
