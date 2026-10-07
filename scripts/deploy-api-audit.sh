#!/usr/bin/env bash
set -euo pipefail
# ISBNDB_API_KEY and HARDCOVER_API_TOKEN must already exist in Supabase secrets.
# Keep the existing cache data, quotas, reader identities, and manual cover choices.
NOVORI_API_AUDIT_PROJECT_REF="${NOVORI_API_AUDIT_PROJECT_REF:-oanpmuiuuwljknwvyzev}"
npx supabase secrets set NOVORI_BOOK_PROVIDER=isbndb --project-ref "$NOVORI_API_AUDIT_PROJECT_REF"
for function_name in google-books-search google-books-detail google-books-resolve hardcover-series hardcover-search-popularity hardcover-trending hardcover-recent-releases; do
 npx supabase functions deploy "$function_name" --project-ref "$NOVORI_API_AUDIT_PROJECT_REF"
done
# Admin performs its own role/session/MFA checks in the handler.
npx supabase functions deploy novori-admin --no-verify-jwt --project-ref "$NOVORI_API_AUDIT_PROJECT_REF"
