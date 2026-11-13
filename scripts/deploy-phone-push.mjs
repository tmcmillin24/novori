import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Copy and export your Supabase CLI token first.');
const project = 'oanpmuiuuwljknwvyzev';
const base = `https://api.supabase.com/v1/projects/${project}`;
async function api(path, body) {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  if (!response.ok) {
    // Never print a response containing credentials or the submitted SQL/secret.
    throw new Error(`Supabase request ${path} failed (${response.status}). Check Project Read, Database Read/write, Edge Functions Read/write, and Edge Function Secrets Read/write permissions.`);
  }
  const text = await response.text();
  return text.trim() ? JSON.parse(text) : null;
}
const query = (sql, readOnly = false) => api('/database/query', { query: sql, read_only: readOnly });
const [foundation] = await query(`select to_regclass('public.notifications') is not null and to_regclass('public.notification_preferences') is not null and to_regclass('public.reading_reminder_preferences') is not null as ready`, true);
if (!foundation?.ready) throw new Error('Notification foundation missing. Stopped without applying changes.');
await query(readFileSync(new URL('../supabase/migrations/20261113020000_phone_push.sql', import.meta.url), 'utf8'));
await query(readFileSync(new URL('../supabase/migrations/20261113030000_push_registration_reinstall.sql', import.meta.url), 'utf8'));
await query(readFileSync(new URL('../supabase/migrations/20261113040000_push_activity_previews.sql', import.meta.url), 'utf8'));
await query(readFileSync(new URL('../supabase/migrations/20261113060000_push_inbox_wording.sql', import.meta.url), 'utf8'));
// Reuse the existing worker secret on reruns. Never return it to the terminal.
const [vault] = await query(`select to_regclass('vault.secrets') is not null as ready`, true);
if (!vault?.ready) throw new Error('Enable Supabase Vault, then rerun this helper. The queue is installed but no delivery is scheduled.');
// Vault decryption needs the privileged connection, not the read-only role.
const [existing] = await query(`select decrypted_secret as value from vault.decrypted_secrets where name='novori_phone_push_worker' limit 1`, false);
const secret = existing?.value ?? randomBytes(32).toString('hex');
if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Existing push worker credential is invalid.');
await api('/secrets', [{ name: 'NOVORI_PUSH_WORKER_SECRET', value: secret }]);
const deployed = spawnSync('npx', ['supabase', 'functions', 'deploy', 'phone-push', '--project-ref', project, '--no-verify-jwt'], { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit' });
if (deployed.error || deployed.status !== 0) throw new Error('Push worker deployment failed. Rerun this helper safely.');
if (!existing?.value) await query(`select vault.create_secret('${secret}','novori_phone_push_worker','Novori phone delivery worker');`);
await query(`
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin perform cron.unschedule(jobid) from cron.job where jobname='novori-phone-push'; end $$;
select cron.schedule('novori-phone-push','* * * * *',$job$
 select net.http_post(
 url:='https://${project}.supabase.co/functions/v1/phone-push',
 headers:=jsonb_build_object('Content-Type','application/json','x-novori-worker',(select decrypted_secret from vault.decrypted_secrets where name='novori_phone_push_worker' limit 1)),
 body:='{}'::jsonb,timeout_milliseconds:=140000);
$job$);`);
const checks = await query(`select jobname,active,schedule from cron.job where jobname in ('novori-phone-push','novori-reading-reminders') order by jobname`, true);
console.log('Phone push backend deployed. Existing book/catalog/cover functions were not deployed or changed.');
console.table(checks);
console.log('Next: configure the Apple push key with EAS, rebuild iOS, enable phone notifications, and use Send me a test notification in Novori settings.');
