-- First create a Vault secret named novori_admin_worker_secret containing a random 64+ character value.
-- Set the identical value as Edge Function secret NOVORI_ADMIN_WORKER_SECRET.
-- Requires Supabase Cron (pg_cron), pg_net and Vault. Does not touch the deletion worker job.
do $$begin
 if to_regclass('cron.job') is null or to_regclass('vault.decrypted_secrets') is null
 or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
  raise exception 'Enable Supabase Cron, pg_net and Vault before scheduling the admin worker.';
 end if;
 if not exists(select 1 from vault.decrypted_secrets where name='novori_admin_worker_secret' and char_length(decrypted_secret)>=32) then
  raise exception 'Create the novori_admin_worker_secret Vault secret first.';
 end if;
end$$;
select cron.schedule('novori-admin-worker','* * * * *',$job$
 select net.http_post(
  url:='https://oanpmuiuuwljknwvyzev.supabase.co/functions/v1/novori-admin',
  headers:=jsonb_build_object('Content-Type','application/json','x-admin-worker-secret',
   (select decrypted_secret from vault.decrypted_secrets where name='novori_admin_worker_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=90000
 );
$job$);
-- Verify via Admin Overview: last successful run must be recent (within a few minutes).
select last_heartbeat,last_result from public.novori_admin_worker_status where singleton;
