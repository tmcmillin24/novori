#!/usr/bin/env bash
set -euo pipefail
# Run from the repository root after authenticating the Supabase CLI.
# Deploy every consumer of the repaired shared catalog helpers together.
project_ref="${NOVORI_SUPABASE_PROJECT_REF:-oanpmuiuuwljknwvyzev}"
node scripts/deploy-cover-content-health.mjs
for function_name in \
  book-edition-pages \
  book-cover-selection \
  google-books-detail \
  google-books-resolve \
  google-books-search \
  hardcover-recent-releases \
  hardcover-search-popularity \
  hardcover-series \
  hardcover-trending \
  open-library-work-cover
do
  npx supabase functions deploy "$function_name" --project-ref "$project_ref"
done
# Updating the legacy function does not enable Open Library as a fallback.
