-- Novori Admin Hub. Additive; preserves existing report intake, caches and deletion orchestration.
-- Apply only to the Novori project after SQL 16/18 and account-deletion SQL 56.
begin;
do $$begin
 if to_regclass('public.content_reports') is null or to_regclass('public.post_comments') is null
 or to_regclass('public.club_members') is null or to_regprocedure('public.novori_account_active(uuid)') is null then
  raise exception 'Existing Novori reports, clubs and account-deletion foundation are required.';
 end if;
end$$;

create table if not exists public.novori_admin_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','moderator','support')),
 enabled boolean not null default true, email_alerts boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.novori_admin_audit (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 request_hash text not null, actor_id uuid references auth.users(id) on delete set null,
 action text not null, target_type text not null, target_id uuid,
 reason text not null, result jsonb, created_at timestamptz not null default now()
);
create table if not exists public.novori_reader_restrictions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 blocked_until timestamptz, permanent boolean not null default false,
 revision uuid not null, reason text not null, updated_at timestamptz not null default now()
);
create table if not exists public.novori_admin_auth_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 revision uuid not null, blocked_until timestamptz, permanent boolean not null default false,
 status text not null default 'pending' check(status in ('pending','processing','completed','superseded')),
 claim_token uuid, lease_until timestamptz, attempts integer not null default 0,
 last_error text, created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists novori_admin_auth_jobs_queue on public.novori_admin_auth_jobs(status,created_at);
create table if not exists public.novori_club_controls (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 posting_paused boolean not null default false, reason text not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.novori_admin_announcements (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 1 and 120),
 body text not null check(char_length(body) between 1 and 2000),
 state text not null default 'draft' check(state in ('draft','published','archived')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 published_at timestamptz, recipient_cursor uuid, delivered_count integer not null default 0,
 delivery_complete boolean not null default false
);
create table if not exists public.novori_admin_report_alerts (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references public.content_reports(id) on delete cascade,
 report_version timestamptz not null, admin_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','sent')),
 claim_token uuid, lease_until timestamptz, attempts integer not null default 0,
 created_at timestamptz not null default now(), sent_at timestamptz,
 unique(report_id,report_version,admin_id)
);
create table if not exists public.novori_admin_worker_status (
 singleton boolean primary key default true check(singleton), last_heartbeat timestamptz, last_result jsonb
);
insert into public.novori_admin_worker_status(singleton) values(true) on conflict do nothing;
-- No browser or ordinary app account can access these service-only tables.
do $$declare t text;begin
 foreach t in array array['novori_admin_worker_status','novori_admin_members','novori_admin_audit','novori_reader_restrictions',
 'novori_admin_auth_jobs','novori_club_controls','novori_admin_announcements','novori_admin_report_alerts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end$$;

create or replace function public.novori_reader_restricted(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.novori_reader_restrictions where user_id=p_user
 and (permanent or blocked_until>now()))
$$;
revoke all on function public.novori_reader_restricted(uuid) from public;
grant execute on function public.novori_reader_restricted(uuid) to authenticated,service_role;

-- Existing JWTs must not be able to write via security-definer app RPCs after suspension.
-- The original deletion guard and all original policies remain intact.
create or replace function public.novori_moderation_mutation_guard() returns trigger
language plpgsql security definer set search_path='' as $$declare row_data jsonb;club uuid;begin
 if auth.uid() is not null then
  if public.novori_reader_restricted(auth.uid()) then raise exception using errcode='42501',message='Your account is restricted. Contact support@novori.link.';end if;
  if tg_op in ('INSERT','UPDATE') and tg_table_name in ('posts','post_comments') then
   row_data:=to_jsonb(new);
   club:=nullif(row_data->>'club_id','')::uuid;
   if club is null and tg_table_name='post_comments' then select club_id into club from public.posts where id=(row_data->>'post_id')::uuid;end if;
   if club is not null and exists(select 1 from public.novori_club_controls where club_id=club and posting_paused) then
    raise exception using errcode='42501',message='Posting in this club is paused.';
   end if;
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
-- Only existing reader tables already guarded by the deletion foundation are affected.
-- Profiles retain their original mutation guard so account-deletion masking/restoration still work.
do $$declare t text;begin
 for t in select distinct tablename from pg_policies where schemaname='public' and policyname='novori_active_account'
 and tablename not like 'account_deletion%' and tablename not in ('book_api_cache','api_usage_daily','google_books_catalog','novori_discover_cache') loop
  execute format('drop policy if exists novori_moderation_access on public.%I',t);
  execute format('create policy novori_moderation_access on public.%I as restrictive to authenticated using (not public.novori_reader_restricted(auth.uid())) with check (not public.novori_reader_restricted(auth.uid()))',t);
  if t<>'profiles' then
   execute format('drop trigger if exists novori_moderation_mutation_guard on public.%I',t);
   execute format('create trigger novori_moderation_mutation_guard before insert or update or delete on public.%I for each row execute function public.novori_moderation_mutation_guard()',t);
  end if;
 end loop;
end$$;
-- Ensure posting controls also cover projects whose early policies used different names.
drop trigger if exists novori_moderation_mutation_guard on public.posts;
create trigger novori_moderation_mutation_guard before insert or update or delete on public.posts for each row execute function public.novori_moderation_mutation_guard();
drop trigger if exists novori_moderation_mutation_guard on public.post_comments;
create trigger novori_moderation_mutation_guard before insert or update or delete on public.post_comments for each row execute function public.novori_moderation_mutation_guard();

create or replace function public.novori_admin_queue_report_alert() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if new.status='pending' then
  insert into public.novori_admin_report_alerts(report_id,report_version,admin_id)
  select new.id,new.updated_at,m.user_id from public.novori_admin_members m where m.enabled and m.email_alerts
  on conflict do nothing;
 end if;
 return new;
end$$;
drop trigger if exists novori_admin_report_alert on public.content_reports;
create trigger novori_admin_report_alert after insert or update on public.content_reports for each row execute function public.novori_admin_queue_report_alert();

create or replace function public.novori_admin_apply_action(
 p_actor uuid,p_request uuid,p_action text,p_target_type text,p_target uuid,p_reason text,
 p_expected timestamptz default null,p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare role_name text;hash text;prior public.novori_admin_audit;rep public.content_reports;
 reader uuid;current_revision uuid;until_time timestamptz;is_permanent boolean:=false;
 job uuid;output jsonb;affected integer;ann public.novori_admin_announcements;club public.clubs;
begin
 select role into role_name from public.novori_admin_members where user_id=p_actor and enabled;
 if role_name is null then raise exception using errcode='42501',message='Administrator access required.';end if;
 if public.novori_reader_restricted(p_actor) or not public.novori_account_active(p_actor) then raise exception using errcode='42501',message='Administrator account unavailable.';end if;
 if p_request is null or p_target is null or coalesce(char_length(trim(p_reason)),0)<5 or char_length(p_reason)>1000 then raise exception using errcode='22023',message='A target, request ID and decision reason (5–1000 characters) are required.';end if;
 if p_action is null or p_target_type is null or p_action not in ('review_report','dismiss_report','remove_content','warn_reader','suspend_reader','ban_reader','restore_reader','edit_club','pause_club','resume_club','save_announcement','publish_announcement','archive_announcement') then raise exception using errcode='22023',message='Unsupported action.';end if;
 if role_name='support' then raise exception using errcode='42501',message='This role is read-only.';end if;
 if p_action in ('edit_club','pause_club','resume_club','save_announcement','publish_announcement','archive_announcement') and role_name<>'owner' then raise exception using errcode='42501',message='Owner access required.';end if;
 hash:=md5(jsonb_build_object('action',p_action,'type',p_target_type,'target',p_target,'reason',p_reason,'expected',p_expected,'payload',p_payload)::text);
 insert into public.novori_admin_audit(request_id,request_hash,actor_id,action,target_type,target_id,reason)
 values(p_request,hash,p_actor,p_action,p_target_type,p_target,trim(p_reason)) on conflict(request_id) do nothing;
 select * into prior from public.novori_admin_audit where request_id=p_request for update;
 if prior.request_hash<>hash or prior.actor_id is distinct from p_actor then raise exception using errcode='22023',message='Request ID already used for another action.';end if;
 if prior.result is not null then return prior.result;end if;

 if p_target_type='report' then
  select * into rep from public.content_reports where id=p_target for update;
  if not found then raise exception using errcode='P0002',message='Report no longer exists.';end if;
  if p_expected is null or rep.updated_at<>p_expected then raise exception using errcode='40001',message='Report changed. Refresh before acting.';end if;
 end if;
 if p_action in ('review_report','dismiss_report','remove_content') then
  if p_target_type<>'report' then raise exception using errcode='22023',message='Select a report.';end if;
  if p_action='remove_content' then
   if rep.target_type='post' then
    delete from public.posts where id=rep.target_id;
   elsif rep.target_type='comment' then
    -- Preserve other readers’ replies, using the existing deletion tombstone contract.
    update public.post_comments set author_id=null,body='This comment was deleted.',updated_at=now() where id=rep.target_id and author_id is not null;
   else raise exception using errcode='22023',message='Use a warning or restriction for profile reports.';end if;
   get diagnostics affected=row_count;
   if affected=0 then raise exception using errcode='P0002',message='Content was already removed.';end if;
  end if;
  update public.content_reports set status=case p_action when 'review_report' then 'reviewed' when 'dismiss_report' then 'dismissed' else 'actioned' end,updated_at=now() where id=p_target;
  output:=jsonb_build_object('completed',true);
 elsif p_action in ('warn_reader','suspend_reader','ban_reader','restore_reader') then
  if p_target_type='reader' then reader:=p_target;
  elsif p_target_type='report' then
   if rep.target_type='profile' then reader:=rep.target_id;
   elsif rep.target_type='post' then select author_id into reader from public.posts where id=rep.target_id;
   elsif rep.target_type='comment' then select author_id into reader from public.post_comments where id=rep.target_id;end if;
  else raise exception using errcode='22023',message='Select a reader or report.';end if;
  if reader is null or not exists(select 1 from public.profiles where id=reader) then raise exception using errcode='P0002',message='Reader no longer exists.';end if;
  if reader=p_actor or exists(select 1 from public.novori_admin_members where user_id=reader and enabled) then raise exception using errcode='42501',message='Administrator accounts cannot be targeted here.';end if;
  perform 1 from auth.users where id=reader for update;
  if p_action<>'warn_reader' then
   is_permanent:=p_action='ban_reader';
   if p_action='suspend_reader' then
    if coalesce(p_payload->>'hours','') not in ('24','168','720') then raise exception using errcode='22023',message='Choose a 1, 7 or 30 day suspension.';end if;
    until_time:=now()+make_interval(hours=>(p_payload->>'hours')::integer);
   elsif is_permanent then until_time:=now()+interval '100 years';end if;
   current_revision:=gen_random_uuid();
   if p_action='restore_reader' then
    -- Keep DB restrictions until Auth unbanning succeeds; worker clears them transactionally.
    insert into public.novori_reader_restrictions(user_id,revision,reason) values(reader,current_revision,trim(p_reason))
    on conflict(user_id) do update set revision=current_revision,reason=excluded.reason,updated_at=now();
   else
    insert into public.novori_reader_restrictions(user_id,blocked_until,permanent,revision,reason)
    values(reader,until_time,is_permanent,current_revision,trim(p_reason)) on conflict(user_id) do update
    set blocked_until=excluded.blocked_until,permanent=excluded.permanent,revision=excluded.revision,reason=excluded.reason,updated_at=now();
   end if;
   insert into public.novori_admin_auth_jobs(user_id,revision,blocked_until,permanent) values(reader,current_revision,until_time,is_permanent) returning id into job;
  end if;
  insert into public.notifications(recipient_id,type,title,body) values(reader,'system',
   case p_action when 'warn_reader' then 'A note from Novori' when 'restore_reader' then 'Account access review' else 'Account moderation notice' end,
   trim(p_reason)||E'\n\nQuestions or an appeal? Contact support@novori.link.');
  if p_target_type='report' then update public.content_reports set status='actioned',updated_at=now() where id=p_target;end if;
  output:=jsonb_build_object('completed',true,'auth_job_id',job,'auth_sync_pending',job is not null,'reader_id',reader);
 elsif p_action in ('edit_club','pause_club','resume_club') then
  if p_target_type<>'club' then raise exception using errcode='22023',message='Select a club.';end if;
  select * into club from public.clubs where id=p_target for update;
  if not found then raise exception using errcode='P0002',message='Club no longer exists.';end if;
  if p_expected is null or club.updated_at<>p_expected then raise exception using errcode='40001',message='Club changed. Refresh before acting.';end if;
  if p_action='edit_club' then
   if char_length(trim(coalesce(p_payload->>'name','')))<1 or char_length(p_payload->>'name')>100
   or char_length(coalesce(p_payload->>'description',''))>2000 or char_length(coalesce(p_payload->>'rules',''))>10000 then raise exception using errcode='22023',message='Club details are invalid.';end if;
   update public.clubs set name=trim(p_payload->>'name'),description=p_payload->>'description',rules=p_payload->>'rules',updated_at=now() where id=p_target;
  else
   insert into public.novori_club_controls(club_id,posting_paused,reason) values(p_target,p_action='pause_club',trim(p_reason))
   on conflict(club_id) do update set posting_paused=excluded.posting_paused,reason=excluded.reason,updated_at=now();
   update public.clubs set updated_at=now() where id=p_target;
  end if;
  output:=jsonb_build_object('completed',true);
 else
  if p_target_type<>'announcement' then raise exception using errcode='22023',message='Select an announcement.';end if;
  select * into ann from public.novori_admin_announcements where id=p_target for update;
  if p_action='save_announcement' and not found then
   if p_expected is not null then raise exception using errcode='P0002',message='Draft no longer exists.';end if;
   insert into public.novori_admin_announcements(id,title,body,created_by) values(p_target,trim(p_payload->>'title'),trim(p_payload->>'body'),p_actor);
  else
   if ann.id is null then raise exception using errcode='P0002',message='Announcement no longer exists.';end if;
   if p_expected is null or ann.updated_at<>p_expected then raise exception using errcode='40001',message='Announcement changed. Refresh before acting.';end if;
   if p_action='save_announcement' then
    if ann.state<>'draft' then raise exception using errcode='22023',message='Only drafts can be edited.';end if;
    update public.novori_admin_announcements set title=trim(p_payload->>'title'),body=trim(p_payload->>'body'),updated_at=now() where id=p_target;
   elsif p_action='publish_announcement' then
    if ann.state<>'draft' then raise exception using errcode='22023',message='Only drafts can be published.';end if;
    update public.novori_admin_announcements set state='published',published_at=now(),updated_at=now() where id=p_target;
   else update public.novori_admin_announcements set state='archived',updated_at=now() where id=p_target;end if;
  end if;
  output:=jsonb_build_object('completed',true,'announcement_id',p_target);
 end if;
 update public.novori_admin_audit set result=output where request_id=p_request;
 return output;
end$$;
revoke all on function public.novori_admin_apply_action(uuid,uuid,text,text,uuid,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.novori_admin_apply_action(uuid,uuid,text,text,uuid,text,timestamptz,jsonb) to service_role;

create or replace function public.novori_admin_claim_auth_job() returns jsonb
language plpgsql security definer set search_path='' as $$declare j public.novori_admin_auth_jobs;token uuid:=gen_random_uuid();begin
 select q.* into j from public.novori_admin_auth_jobs q join public.novori_reader_restrictions r on r.user_id=q.user_id
 where (q.status='pending' or (q.status='processing' and q.lease_until<now()))
 and not exists(select 1 from public.novori_admin_auth_jobs other where other.user_id=q.user_id and other.id<>q.id and other.status='processing' and other.lease_until>now())
 order by q.created_at,q.id for update of q,r skip locked limit 1;
 if not found then return null;end if;
 if not exists(select 1 from public.novori_reader_restrictions where user_id=j.user_id and revision=j.revision) then
  update public.novori_admin_auth_jobs set status='superseded',completed_at=now() where id=j.id;
  return jsonb_build_object('superseded',true);
 end if;
 update public.novori_admin_auth_jobs set status='processing',claim_token=token,lease_until=now()+interval '2 minutes',attempts=attempts+1 where id=j.id;
 return to_jsonb(j)||jsonb_build_object('claim_token',token);
end$$;
create or replace function public.novori_admin_finish_auth_job(p_id uuid,p_token uuid,p_success boolean) returns void
language plpgsql security definer set search_path='' as $$declare j public.novori_admin_auth_jobs;begin
 select * into j from public.novori_admin_auth_jobs where id=p_id and claim_token=p_token and status='processing' for update;
 if not found then raise exception using errcode='40001',message='Job lease changed.';end if;
 update public.novori_admin_auth_jobs set status=case when p_success then 'completed' else 'pending' end,
 claim_token=null,lease_until=null,last_error=case when p_success then null else 'Auth synchronization failed; queued for retry.' end,
 completed_at=case when p_success then now() else null end where id=p_id;
 if p_success and j.blocked_until is null and not j.permanent then
  update public.novori_reader_restrictions set blocked_until=null,permanent=false,updated_at=now() where user_id=j.user_id and revision=j.revision;
 end if;
end$$;

create or replace function public.novori_admin_deliver_announcement(p_id uuid) returns integer
language plpgsql security definer set search_path='' as $$declare a public.novori_admin_announcements;ids uuid[];last_id uuid;n integer;begin
 select * into a from public.novori_admin_announcements where id=p_id and state='published' and not delivery_complete for update skip locked;
 if not found then return 0;end if;
 select array_agg(id),count(*) into ids,n from (select p.id from public.profiles p where (a.recipient_cursor is null or p.id>a.recipient_cursor)
 and public.novori_account_active(p.id) and not public.novori_reader_restricted(p.id) order by p.id limit 100) batch;
 if n>0 then
  insert into public.notifications(recipient_id,type,title,body) select unnest(ids),'system',a.title,a.body;
  last_id:=ids[array_length(ids,1)];
 end if;
 update public.novori_admin_announcements set recipient_cursor=coalesce(last_id,recipient_cursor),
 delivered_count=delivered_count+n,delivery_complete=n<100 where id=p_id;
 return n;
end$$;
create or replace function public.novori_admin_claim_alert() returns jsonb
language plpgsql security definer set search_path='' as $$declare a public.novori_admin_report_alerts;token uuid:=gen_random_uuid();begin
 select q.* into a from public.novori_admin_report_alerts q join public.novori_admin_members m on m.user_id=q.admin_id
 where m.enabled and m.email_alerts and (q.status='pending' or (q.status='processing' and q.lease_until<now()))
 order by q.created_at for update of q skip locked limit 1;
 if not found then return null;end if;
 update public.novori_admin_report_alerts set status='processing',claim_token=token,lease_until=now()+interval '2 minutes',attempts=attempts+1 where id=a.id;
 return to_jsonb(a)||jsonb_build_object('claim_token',token);
end$$;
create or replace function public.novori_admin_finish_alert(p_id uuid,p_token uuid,p_success boolean) returns void
language plpgsql security definer set search_path='' as $$begin
 update public.novori_admin_report_alerts set status=case when p_success then 'sent' else 'pending' end,
 claim_token=null,lease_until=null,sent_at=case when p_success then now() else null end
 where id=p_id and claim_token=p_token and status='processing';
 if not found then raise exception using errcode='40001',message='Alert lease changed.';end if;
end$$;
do $$declare sig text;begin
 foreach sig in array array['novori_admin_claim_auth_job()','novori_admin_finish_auth_job(uuid,uuid,boolean)',
 'novori_admin_deliver_announcement(uuid)','novori_admin_claim_alert()','novori_admin_finish_alert(uuid,uuid,boolean)'] loop
  execute 'revoke all on function public.'||sig||' from public,anon,authenticated';
  execute 'grant execute on function public.'||sig||' to service_role';
 end loop;
end$$;
revoke all on function public.novori_moderation_mutation_guard(),public.novori_admin_queue_report_alert() from public,anon,authenticated;
commit;
