#!/usr/bin/env bash
set -euo pipefail
# Run the staged SQL migration first. Add secrets in Supabase Dashboard first:
# OPENAI_API_KEY, NOVORI_MEDIA_ORIGIN_SECRET. Never put these in EXPO_PUBLIC_*.
NOVORI_MODERATION_PROJECT_REF="${NOVORI_MODERATION_PROJECT_REF:-oanpmuiuuwljknwvyzev}"
npx supabase secrets set NOVORI_LEGAL_VERSION=2026-10-05-moderation --project-ref "$NOVORI_MODERATION_PROJECT_REF"
# Every handler verifies its own reader identity, signup receipt, admin MFA,
# or private origin secret. This also supports current Supabase publishable keys.
for function_name in ugc-publish ugc-media ugc-signup ugc-media-origin novori-admin account-deletion-worker; do
 npx supabase functions deploy "$function_name" --no-verify-jwt --project-ref "$NOVORI_MODERATION_PROJECT_REF"
done
