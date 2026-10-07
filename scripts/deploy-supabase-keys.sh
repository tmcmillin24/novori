#!/usr/bin/env bash
set -euo pipefail
NOVORI_KEYS_PROJECT_REF="${NOVORI_KEYS_PROJECT_REF:-oanpmuiuuwljknwvyzev}"
# Add NOVORI_SERVER_KEY (sb_secret_...) and NOVORI_PUBLISHABLE_KEY (sb_publishable_...)
# in Dashboard secrets first. Never pass keys on the command line.
for function_name in google-books-search google-books-detail google-books-resolve book-cover-selection open-library-work-cover hardcover-series hardcover-search-popularity hardcover-trending hardcover-recent-releases; do
 npx supabase functions deploy "$function_name" --project-ref "$NOVORI_KEYS_PROJECT_REF"
done
for function_name in ugc-publish ugc-media ugc-signup ugc-media-origin novori-admin account-deletion-worker; do
 npx supabase functions deploy "$function_name" --no-verify-jwt --project-ref "$NOVORI_KEYS_PROJECT_REF"
done
