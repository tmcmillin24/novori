begin;
-- Additive delivery layer. Existing inbox/reminder generation remains authoritative.
do $$ begin
 if to_regclass('public.notifications') is null or to_regclass('public.notification_preferences') is null
 or to_regclass('public.reading_reminder_preferences') is null
 or to_regprocedure('public.novori_account_active(uuid)') is null
 or to_regprocedure('public.novori_reader_restricted(uuid)') is null
 or to_regprocedure('public.get_club_member_experience(uuid)') is null
 or to_regprocedure('public.is_reader_blocked_by_viewer(uuid)') is null then
 raise exception 'Notification/account foundation missing; no changes applied.'; end if;
end $$;

create table if not exists public.novori_push_devices (
 install_id uuid primary key,
 secret_hash text not null,
 user_id uuid references auth.users(id) on delete cascade,
 expo_token text unique,
 platform text not null check(platform in ('ios','android')),
 project_id uuid not null,
 generation uuid not null default gen_random_uuid(),
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.novori_push_outbox (
 id bigint generated always as identity primary key,
 notification_id uuid not null references public.notifications(id) on delete cascade,
 install_id uuid not null references public.novori_push_devices(install_id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 generation uuid not null,
 state text not null default 'pending' check(state in ('pending','sending','receipt','checking','delivered','failed','skipped','uncertain')),
 attempts int not null default 0,
 available_at timestamptz not null default now(),
 lease_id uuid,
 ticket_id text,
 error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(notification_id,install_id,generation)
);
create index if not exists novori_push_ready on public.novori_push_outbox(available_at,id) where state in ('pending','receipt','sending','checking');
alter table public.novori_push_devices enable row level security;
alter table public.novori_push_outbox enable row level security;
revoke all on public.novori_push_devices, public.novori_push_outbox from anon,authenticated;
grant all on public.novori_push_devices, public.novori_push_outbox to service_role;
grant usage,select on sequence public.novori_push_outbox_id_seq to service_role;

create or replace function public.novori_register_push_device(p_install uuid,p_secret text,p_token text,p_platform text,p_project uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare reader uuid:=auth.uid(); old public.novori_push_devices;
begin
 if reader is null or not public.novori_account_active(reader) or public.novori_reader_restricted(reader) then raise exception 'Account unavailable' using errcode='42501'; end if;
 if p_secret is null or p_secret !~ '^[a-f0-9]{64}$' or p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
 or p_platform is null or p_platform not in ('ios','android') or p_project is distinct from '30e6f9f0-79ba-4420-9217-433fa022e460'::uuid or p_install is null then raise exception 'Invalid push registration' using errcode='22023'; end if;
 select * into old from public.novori_push_devices where install_id=p_install for update;
 -- The secret is random 256-bit installation proof; not an account password.
 if found and old.secret_hash<>encode(sha256(convert_to(p_secret,'UTF8')),'hex') then raise exception 'Invalid installation proof' using errcode='42501'; end if;
 insert into public.novori_push_devices(install_id,secret_hash,user_id,expo_token,platform,project_id)
 values(p_install,encode(sha256(convert_to(p_secret,'UTF8')),'hex'),reader,p_token,p_platform,p_project)
 on conflict(install_id) do update set
 generation=case when novori_push_devices.user_id is distinct from reader or novori_push_devices.expo_token is distinct from p_token or not novori_push_devices.enabled then gen_random_uuid() else novori_push_devices.generation end,
 user_id=reader,expo_token=p_token,platform=p_platform,project_id=p_project,enabled=true,updated_at=now();
end $$;

create or replace function public.novori_unregister_push_device(p_install uuid,p_secret text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_secret is null or p_secret !~ '^[a-f0-9]{64}$' then return; end if;
 update public.novori_push_devices set enabled=false,user_id=null,expo_token=null,generation=gen_random_uuid(),updated_at=now()
 where install_id=p_install and secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex');
end $$;

-- Existing club RPC is reused under the recipient context so per-club mute rules
-- do not get reimplemented against a guessed membership schema.
create or replace function public.novori_push_allowed(p_notification uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare n public.notifications; prefs jsonb; pref text; reminder text; club uuid; experience jsonb; blocked boolean;
 prior_sub text:=current_setting('request.jwt.claim.sub',true); prior_claims text:=current_setting('request.jwt.claims',true);
begin
 select * into n from public.notifications where id=p_notification;
 if not found or n.read_at is not null or n.created_at < now()-interval '1 day'
 or not public.novori_account_active(n.recipient_id) or public.novori_reader_restricted(n.recipient_id) then return false; end if;
 if n.actor_id is not null and (not public.novori_account_active(n.actor_id) or public.novori_reader_restricted(n.actor_id)) then return false; end if;
 if n.actor_id is not null then
  perform set_config('request.jwt.claim.sub',n.recipient_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',n.recipient_id,'role','authenticated')::text,true);
  execute 'select public.is_reader_blocked_by_viewer($1)' into blocked using n.actor_id;
  if not coalesce(blocked,false) then
   perform set_config('request.jwt.claim.sub',n.actor_id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',n.actor_id,'role','authenticated')::text,true);
   execute 'select public.is_reader_blocked_by_viewer($1)' into blocked using n.recipient_id;
  end if;
  perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
  perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
  if coalesce(blocked,false) then return false; end if;
 end if;
 if n.type='system' and n.entity_type='reading_reminder' then
  reminder:=n.metadata->>'reading_reminder_kind';
  if reminder not in ('daily_checkin','still_reading','weekly_recap','monthly_recap') or reminder is null then return false; end if;
  select to_jsonb(p) into prefs from public.reading_reminder_preferences p where user_id=n.recipient_id;
  return coalesce((prefs->>reminder)::boolean,false);
 end if;
 if n.type='system' and n.entity_type='push_test' then return true; end if;
 pref:=case when n.type in ('follow','follow_request','follow_request_accepted') then 'new_followers'
 when n.type in ('post_like','review_like','post_vote','comment_vote','comment','reply') then 'reactions_and_replies'
 when n.type='club_invite' then 'club_invites' when n.type in ('club_post','club_event','club_member') then 'club_activity'
 when n.type='reading_started' then 'reading_started' when n.type='reading_finished' then 'reading_finished' end;
 if pref is null then return false; end if;
 select to_jsonb(p) into prefs from public.notification_preferences p where user_id=n.recipient_id;
 if prefs is not null and not coalesce((prefs->>pref)::boolean,true) then return false; end if;
 -- Replies can carry club_id even when entity_type is post.
 club:=case when n.entity_type='club' then n.entity_id::text::uuid else nullif(n.metadata->>'club_id','')::uuid end;
 if club is not null and n.type<>'club_invite' then
  perform set_config('request.jwt.claim.sub',n.recipient_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',n.recipient_id,'role','authenticated')::text,true);
  execute 'select to_jsonb(public.get_club_member_experience($1))' into experience using club;
  perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
  perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
  if not coalesce((experience->>'notifications_enabled')::boolean,false) or not coalesce((experience->>'global_notifications_enabled')::boolean,false) then return false; end if;
 end if;
 return true;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
 return false; -- Never send when access/preferences cannot be verified.
end $$;

create or replace function public.novori_queue_push()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 insert into public.novori_push_outbox(notification_id,install_id,recipient_id,generation)
 select new.id,d.install_id,new.recipient_id,d.generation from public.novori_push_devices d
 where d.user_id=new.recipient_id and d.enabled and d.expo_token is not null
 on conflict do nothing;
 return new;
end $$;
drop trigger if exists novori_queue_phone_push on public.notifications;
create trigger novori_queue_phone_push after insert on public.notifications for each row execute function public.novori_queue_push();

create or replace function public.novori_claim_push()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 delete from public.novori_push_outbox where state in ('delivered','failed','skipped','uncertain') and updated_at<now()-interval '30 days';
 -- Ambiguous sends are not blindly replayed; receipts are safe to retry.
 update public.novori_push_outbox set state='uncertain',error_code='worker_interrupted',updated_at=now() where state='sending' and updated_at<now()-interval '5 minutes';
 update public.novori_push_outbox set state='receipt',available_at=now(),updated_at=now() where state='checking' and updated_at<now()-interval '5 minutes';
 update public.novori_push_outbox o set state='skipped',updated_at=now()
 where o.state='pending' and o.available_at<=now() and
 (not exists(select 1 from public.novori_push_devices d where d.install_id=o.install_id and d.generation=o.generation and d.user_id=o.recipient_id and d.enabled) or not public.novori_push_allowed(o.notification_id));
 with candidates as (
 select o.id from public.novori_push_outbox o where o.state in ('pending','receipt') and o.available_at<=now()
 order by o.available_at,o.id limit 25 for update skip locked
 ), claimed as (
 update public.novori_push_outbox o set state=case when state='receipt' then 'checking' else 'sending' end,lease_id=gen_random_uuid(),attempts=attempts+1,updated_at=now()
 from candidates c where o.id=c.id returning o.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'lease',o.lease_id,'state',o.state,'attempts',o.attempts,'ticket',o.ticket_id,
 'token',d.expo_token,'recipient',o.recipient_id,'notification',o.notification_id,
 'title',case when n.entity_type='reading_reminder' then n.title else 'Novori' end,
 'body',case when n.entity_type='push_test' then 'Phone notifications are working.' else 'You have an update waiting in Novori.' end)), '[]'::jsonb)
 into result from claimed o join public.novori_push_devices d on d.install_id=o.install_id join public.notifications n on n.id=o.notification_id;
 return result;
end $$;

create or replace function public.novori_push_still_valid(p_id bigint,p_lease uuid)
returns boolean language sql security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.novori_push_outbox o join public.novori_push_devices d on d.install_id=o.install_id
 where o.id=p_id and o.lease_id=p_lease and o.state='sending' and d.generation=o.generation and d.user_id=o.recipient_id and d.enabled and public.novori_push_allowed(o.notification_id));
$$;

create or replace function public.novori_finish_push(p_id bigint,p_lease uuid,p_state text,p_ticket text default null,p_error text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare job public.novori_push_outbox;
begin
 select * into job from public.novori_push_outbox where id=p_id and lease_id=p_lease and state in ('sending','checking') for update;
 if not found then return; end if;
 if p_state not in ('pending','receipt','delivered','failed','skipped','uncertain') then raise exception 'Invalid delivery state'; end if;
 if p_state in ('pending','receipt') and job.attempts>=12 then p_state:='failed'; end if;
 update public.novori_push_outbox set state=p_state,ticket_id=coalesce(p_ticket,ticket_id),error_code=left(p_error,80),
 available_at=now()+case when p_state='receipt' then interval '15 minutes' else make_interval(secs=>least(3600,30*power(2,least(job.attempts,7))::int)) end,
 updated_at=now() where id=p_id;
 if p_error='DeviceNotRegistered' then
 update public.novori_push_devices set enabled=false,updated_at=now() where install_id=job.install_id and generation=job.generation;
 end if;
end $$;

create or replace function public.novori_test_push()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare reader uuid:=auth.uid();
begin
 if reader is null or not public.novori_account_active(reader) or public.novori_reader_restricted(reader) then raise exception 'Account unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(reader::text),117);
 if exists(select 1 from public.notifications where recipient_id=reader and entity_type='push_test' and created_at>now()-interval '1 minute') then return; end if;
 insert into public.notifications(recipient_id,type,title,body,entity_type,metadata)
 values(reader,'system','Phone notifications','Phone notifications are working.','push_test','{}');
end $$;

revoke all on function public.novori_register_push_device(uuid,text,text,text,uuid),public.novori_unregister_push_device(uuid,text),public.novori_test_push(),public.novori_push_allowed(uuid),public.novori_queue_push(),public.novori_claim_push(),public.novori_push_still_valid(bigint,uuid),public.novori_finish_push(bigint,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.novori_register_push_device(uuid,text,text,text,uuid),public.novori_test_push() to authenticated;
grant execute on function public.novori_unregister_push_device(uuid,text) to anon,authenticated;
grant execute on function public.novori_claim_push(),public.novori_push_still_valid(bigint,uuid),public.novori_finish_push(bigint,uuid,text,text,text) to service_role;
-- Only diagnostic state is returned; tokens and notification content stay private.
commit;
