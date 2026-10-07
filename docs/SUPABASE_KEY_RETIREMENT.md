# Retire the exposed legacy service-role key

The app credentials file must remain outside the Novori project: `../novori-moderation.env`. Never import it or paste keys into logs/chat. The OpenAI key must match the rotated value in both this local file and Supabase OPENAI_API_KEY.

1. Create a modern Supabase secret key (sb_secret_...) named novori-server. Use it in the local file's SUPABASE_SERVICE_ROLE_KEY variable; scripts retain that variable name for compatibility.
2. In Supabase Edge Function Secrets, add NOVORI_SERVER_KEY with that same new secret value. Add NOVORI_PUBLISHABLE_KEY with the project's sb_publishable_... key from API Keys. This second key is public, not a service key.
3. Pull phase5-ask-readers and run `bash scripts/deploy-supabase-keys.sh`. The shared selector prefers the explicit modern keys across scanner, deletion, admin, cover and discovery/cache functions. The legacy fallback remains only for staged transition. Do not change the current ECC signing key.
4. Confirm the app's EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY uses sb_publishable_..., and Cloudflare Pages admin's NOVORI_SUPABASE_PUBLISHABLE_KEY also uses sb_publishable_.... If needed update and rebuild the admin Pages project. Check any other website, automation, Vault or cron job using legacy apikey/Authorization headers; the repository's admin worker uses its own worker secret. Installed historical deletion job configuration requires a live check.
5. Verify ordinary account sign-in, book search/details/series/covers, admin login/action and worker heartbeat, and scanner safe text/image writes. Do not enable moderation enforcement until these and the protected media tests pass. Test a disposable deletion job using the existing grace-period workflow.
6. Only once all consumers are modern, disable legacy anon/service_role API keys in Settings > API Keys. Then in JWT Signing Keys revoke the previously used **legacy symmetric/HS256 key**, after confirming its identity; leave current ECC active. A previously used ECC key is not the legacy secret. Existing sessions signed by the retired key may need refresh/sign-in. Do not infer key identity from its position in the list.
7. Verify the old service-role key is rejected, without printing it, and repeat the app/admin/worker checks. Creating the replacement alone does not revoke the old key. Allow platform changes to propagate before concluding verification.

Sources: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys and https://supabase.com/docs/guides/auth/signing-keys .
