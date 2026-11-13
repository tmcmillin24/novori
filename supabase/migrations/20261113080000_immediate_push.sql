begin;
-- pg_net submits asynchronously after commit; user writes never wait for APNs.
create table if not exists public.novori_push_wake_state (
 id boolean primary key default true check(id), last_wake_at timestamptz not null default '-infinity'
);
insert into public.novori_push_wake_state(id) values(true) on conflict do nothing;
alter table public.novori_push_wake_state enable row level security;
revoke all on public.novori_push_wake_state from public,anon,authenticated;
create or replace function public.novori_wake_phone_push()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare worker_secret text; acquired boolean;
begin
 if not exists(select 1 from inserted_push_jobs where state='pending' and available_at<=now()) then return null; end if;
 -- One wake per short burst, not one HTTP request per device or recap recipient.
 update public.novori_push_wake_state set last_wake_at=clock_timestamp()
 where id=true and last_wake_at<clock_timestamp()-interval '1 second' returning true into acquired;
 if not coalesce(acquired,false) then return null; end if;
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='novori_phone_push_worker' limit 1;
 if worker_secret is null then raise exception 'Push worker credential missing'; end if;
 perform net.http_post(url:='https://oanpmuiuuwljknwvyzev.supabase.co/functions/v1/phone-push',
 headers:=jsonb_build_object('Content-Type','application/json','x-novori-worker',worker_secret),body:='{}'::jsonb,timeout_milliseconds:=140000);
 return null;
exception when others then
 -- A delivery outage must not prevent comments, follows, or recap creation.
 raise warning 'Immediate push wake failed (%); scheduled delivery remains active',SQLSTATE;
 return null;
end $$;
revoke all on function public.novori_wake_phone_push() from public,anon,authenticated;
drop trigger if exists novori_wake_phone_push on public.novori_push_outbox;
create trigger novori_wake_phone_push after insert on public.novori_push_outbox
 referencing new table as inserted_push_jobs for each statement execute function public.novori_wake_phone_push();
commit;
