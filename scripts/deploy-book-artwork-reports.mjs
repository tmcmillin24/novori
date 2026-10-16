import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const foundationQuery = `select
 to_regclass('public.book_artwork_reports') is not null as reports_table,
 to_regclass('public.novori_book_artwork_report_queue') is not null as queue_view,
 to_regprocedure('public.submit_book_artwork_report(text,text,text)') is not null as intake_rpc,
 to_regprocedure('public.novori_admin_review_book_artwork(uuid,uuid,text,text,text,uuid)') is not null as review_rpc;`;
const complete = state => ['reports_table','queue_view','intake_rpc','review_rpc'].every(key => state?.[key] === true);

export async function deployBookArtworkReports({
  token = process.env.SUPABASE_ACCESS_TOKEN,
  project = process.env.NOVORI_SUPABASE_PROJECT_REF ?? 'oanpmuiuuwljknwvyzev',
  fetchImpl = fetch, run = spawnSync, log = console.log,
} = {}) {
  if (!token) throw new Error('Copy your CLI token and export SUPABASE_ACCESS_TOKEN first.');
  if (!/^[a-z0-9]{20}$/.test(project)) throw new Error('Invalid Supabase project reference.');
  const origin = `https://api.supabase.com/v1/projects/${project}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  // Check function access before applying SQL, so missing deployment permissions fail early.
  const access = await fetchImpl(`${origin}/functions/novori-admin`, { headers, signal: AbortSignal.timeout(30000) });
  if (!access.ok) throw new Error(`Cannot access the existing admin function (${access.status}). The token needs Edge Functions Read-write access for this project. No migration was applied.`);
  async function query(sql, readOnly) {
    const response = await fetchImpl(`${origin}/database/query`, {
      method: 'POST', headers, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ query: sql, read_only: readOnly }),
    });
    if (!response.ok) throw new Error(`Database operation failed (${response.status}): ${(await response.text()).slice(0,600)}. The token needs Database Read-write access.`);
    return response.json();
  }
  const [before] = await query(foundationQuery, true);
  if (!before || Object.values(before).some(value => typeof value !== 'boolean')) throw new Error('Could not verify book-report database state. Deployment stopped.');
  if (!complete(before)) {
    if (Object.values(before).some(Boolean)) throw new Error('Only part of the report foundation exists. Deployment stopped; inspect it before retrying.');
    const migration = readFileSync(new URL('../supabase/migrations/20261016010000_book_artwork_reports.sql', import.meta.url), 'utf8');
    await query(migration, false);
    const [after] = await query(foundationQuery, true);
    if (!complete(after)) throw new Error('Book-report database verification failed. Admin deployment stopped.');
    log('Book-report database foundation applied and verified.');
  } else log('Book-report foundation already exists; migration skipped.');
  await query("notify pgrst, 'reload schema';", false);
  const deployed = run('npx', ['supabase','functions','deploy','novori-admin','--project-ref',project,'--no-verify-jwt'], {
    stdio: 'inherit', cwd: fileURLToPath(new URL('../',import.meta.url)),
  });
  if (deployed.error || deployed.status !== 0) throw new Error('Admin function deployment failed. The report migration remains installed; rerunning this helper is safe.');
  log('BOOK REPORT BACKEND DEPLOYED. No catalog/provider functions or cover selections were changed.');
  log('Next: promote beta-updates to the live code branch, verify Cloudflare Admin deployment, and submit the new TestFlight build.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  deployBookArtworkReports().catch(error => { console.error(error.message); process.exitCode = 1; });
}
