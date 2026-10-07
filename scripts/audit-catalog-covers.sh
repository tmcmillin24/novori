#!/usr/bin/env bash
set -euo pipefail
# Saved personal access token; never an account/database password.
: "${SUPABASE_ACCESS_TOKEN:?Export your saved Supabase personal access token first.}"
project_ref="${NOVORI_SUPABASE_PROJECT_REF:-oanpmuiuuwljknwvyzev}"
script_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
request_file="$(mktemp)"
trap 'rm -f "$request_file"' EXIT
node -e 'const fs=require("fs");process.stdout.write(JSON.stringify({query:fs.readFileSync(process.argv[1],"utf8"),read_only:true}));' "$script_root/docs/diagnostics/catalog-cover-health.sql" > "$request_file"
curl --fail-with-body --silent --show-error \
  "https://api.supabase.com/v1/projects/${project_ref}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data-binary "@${request_file}"
printf '\n'
