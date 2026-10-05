-- Stage before deploying the new app. Enforcement stays OFF until setup is verified.
begin;
create table if not exists public.novori_moderation_config (
 singleton boolean primary key default true check(singleton), enforcement_enabled boolean not null default false,
 media_origin text, legal_version text not null default '2026-10-05-moderation'
);
insert into public.novori_moderation_config(singleton) values(true) on conflict do nothing;
create table if not exists public.novori_content_screenings (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 request_key text not null check(length(request_key)=64), surface text not null, content jsonb not null,
 state text not null check(state in ('passed','pending','approved','rejected')), categories jsonb not null default '{}',
 priority_rank integer generated always as (case when categories->>'sexual/minors'='true' then 3 when state='pending' then 2 else 1 end) stored,
 model text not null, media_path text, reason text, decided_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
 unique(user_id,request_key)
);
create index if not exists novori_screenings_queue on public.novori_content_screenings(state,created_at);
create table if not exists public.novori_publication_tickets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 request_path text not null, expires_at timestamptz not null default now()+interval '60 seconds'
);
create table if not exists public.novori_screening_rate_limits (
 user_id uuid primary key references auth.users(id) on delete cascade, window_start timestamptz not null, requests integer not null
);
create table if not exists public.novori_moderated_media (
 bucket text not null, path text not null, user_id uuid not null references auth.users(id) on delete cascade,
 sha256 text not null, blocked boolean not null default false, created_at timestamptz not null default now(), primary key(bucket,path)
);
create table if not exists public.novori_blocked_image_hashes (
 user_id uuid not null references auth.users(id) on delete cascade,sha256 text not null,reason text not null,created_at timestamptz not null default now(),primary key(user_id,sha256)
);
create table if not exists public.novori_legal_acceptances (
 user_id uuid not null references auth.users(id) on delete cascade, version text not null, accepted_at timestamptz not null default now(), primary key(user_id,version)
);
do $$declare t text;begin
 foreach t in array array['novori_moderation_config','novori_content_screenings','novori_publication_tickets','novori_screening_rate_limits','novori_moderated_media','novori_blocked_image_hashes','novori_legal_acceptances'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end$$;
create or replace function public.novori_claim_screening(p_user uuid,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$declare n integer;s text;begin
 if not public.novori_account_active(p_user) or public.novori_reader_restricted(p_user) then raise exception 'Account unavailable';end if;
 insert into public.novori_screening_rate_limits(user_id,window_start,requests) values(p_user,now(),1)
 on conflict(user_id) do update set requests=case when novori_screening_rate_limits.window_start<now()-interval '1 minute' then 1 else novori_screening_rate_limits.requests+1 end,
 window_start=case when novori_screening_rate_limits.window_start<now()-interval '1 minute' then now() else novori_screening_rate_limits.window_start end returning requests into n;
 select state into s from public.novori_content_screenings where user_id=p_user and request_key=p_key and expires_at>now();
 return jsonb_build_object('allowed',n<=30,'state',s);
end$$;
create or replace function public.novori_record_screening(p_user uuid,p_key text,p_surface text,p_content jsonb,p_flagged boolean,p_categories jsonb,p_model text,p_media text default null) returns jsonb
language plpgsql security definer set search_path='' as $$declare r public.novori_content_screenings;begin
 insert into public.novori_content_screenings(user_id,request_key,surface,content,state,categories,model,media_path)
 values(p_user,p_key,p_surface,p_content,case when p_flagged then 'pending' else 'passed' end,p_categories,p_model,p_media)
 on conflict(user_id,request_key) do update set state=case when novori_content_screenings.expires_at>now() then novori_content_screenings.state else excluded.state end,
 content=excluded.content,categories=excluded.categories,model=excluded.model,media_path=excluded.media_path,updated_at=now(),expires_at=now()+interval '7 days'
 returning * into r;return jsonb_build_object('id',r.id,'state',r.state);
end$$;
create or replace function public.novori_issue_publication_ticket(p_user uuid,p_path text,p_key text,p_version text) returns uuid
language plpgsql security definer set search_path='' as $$declare ticket uuid;begin
 if not public.novori_account_active(p_user) or public.novori_reader_restricted(p_user) then raise exception 'Account unavailable';end if;
 if not exists(select 1 from public.novori_content_screenings where user_id=p_user and request_key=p_key and state in ('passed','approved') and expires_at>now()) then raise exception 'Screening required';end if;
 insert into public.novori_legal_acceptances(user_id,version) values(p_user,p_version) on conflict do nothing;
 delete from public.novori_publication_tickets where expires_at<now();
 insert into public.novori_publication_tickets(user_id,request_path) values(p_user,p_path) returning id into ticket;return ticket;
end$$;
create or replace function public.novori_publication_guard() returns trigger
language plpgsql security definer set search_path='' as $$declare fields text[];f text;changed boolean:=false;h jsonb;token uuid;claims jsonb;begin
 if not exists(select 1 from public.novori_moderation_config where enforcement_enabled) then return new;end if;
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
 -- Trusted operator SQL and service workers retain masking/deletion/admin capabilities.
 if claims->>'role'='service_role' or (auth.uid() is null and coalesce(current_setting('request.path',true),'')='') then return new;end if;
 -- These existing RPCs only remove/mask or restore previously published content.
 -- PostgREST sets request.path itself; callers cannot supply this setting.
 if current_setting('request.path',true) in ('/rpc/delete_post_comment','/rpc/request_account_deletion','/rpc/cancel_account_deletion') then return new;end if;
 fields:=case tg_table_name
 when 'posts' then array['body','post_image_url','book_title','book_authors','book_series_name','book_cover_url'] when 'post_comments' then array['body']
 when 'profiles' then array['username','display_name','bio','avatar_url'] when 'user_books' then array['review_text','title','authors','cover_url']
 when 'book_stack_items' then array['title','authors','cover_url'] when 'club_reads' then array['note','book']
 when 'book_stacks' then array['name','description'] when 'clubs' then array['name','description','rules','cover_url']
 when 'club_discussions' then array['title','prompt','options','spoiler_label','book'] when 'club_events' then array['title','description','location','meeting_url','book'] end;
 foreach f in array fields loop
 if tg_op='INSERT' then changed:=changed or coalesce(to_jsonb(new)->f,'null'::jsonb) not in ('null'::jsonb,'""'::jsonb,'[]'::jsonb);
 else changed:=changed or (to_jsonb(new)->f is distinct from to_jsonb(old)->f);end if;
 end loop;
 if not changed then return new;end if;
 begin h:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);token:=(h->>'x-novori-moderation-ticket')::uuid;exception when others then token:=null;end;
 if auth.uid() is null or token is null or not exists(select 1 from public.novori_publication_tickets where id=token and user_id=auth.uid() and expires_at>now() and request_path=current_setting('request.path',true)) then
 raise exception using errcode='42501',message='Update Novori to publish through safety checks. Nothing was published.';end if;
 return new;
end$$;
do $$declare t text;begin
 foreach t in array array['posts','post_comments','profiles','user_books','book_stacks','book_stack_items','club_reads','clubs','club_discussions','club_events'] loop
 if to_regclass('public.'||t) is not null then
 execute format('drop trigger if exists novori_publication_guard on public.%I',t);
 execute format('create trigger novori_publication_guard before insert or update on public.%I for each row execute function public.novori_publication_guard()',t);
 end if;end loop;
end$$;
create or replace function public.novori_admin_review_screening(p_actor uuid,p_id uuid,p_expected timestamptz,p_decision text,p_reason text,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare r public.novori_content_screenings;prior public.novori_admin_audit;hash text;begin
 if not exists(select 1 from public.novori_admin_members where user_id=p_actor and enabled and role in ('owner','moderator')) or public.novori_reader_restricted(p_actor) or not public.novori_account_active(p_actor) then raise exception using errcode='42501',message='Moderator required';end if;
 if p_decision not in ('approved','rejected') or coalesce(length(trim(p_reason)),0)<5 or length(p_reason)>1000 or p_request is null then raise exception 'Decision and reason required';end if;
 hash:=md5(p_id::text||p_decision||p_reason);
 select * into prior from public.novori_admin_audit where request_id=p_request;
 if found then if prior.actor_id<>p_actor or prior.request_hash<>hash then raise exception 'Request changed';end if;return prior.result;end if;
 select * into r from public.novori_content_screenings where id=p_id for update;
 if not found or (r.state<>'pending' and not(r.state='rejected' and p_decision='approved')) or r.updated_at is distinct from p_expected then raise exception using errcode='40001',message='Review changed. Refresh.';end if;
 if r.surface like 'media:%' or r.surface like 'legacy-media:%' then
 if p_decision='rejected' then insert into public.novori_blocked_image_hashes(user_id,sha256,reason) values(r.user_id,r.content->>'image_sha256',trim(p_reason)) on conflict(user_id,sha256) do update set reason=excluded.reason;
 else delete from public.novori_blocked_image_hashes where user_id=r.user_id and sha256=r.content->>'image_sha256';end if;end if;
 if r.surface like 'legacy-media:%' then
 update public.novori_moderated_media set blocked=(p_decision<>'approved') where bucket=r.content->>'bucket' and path=r.content->>'path' and sha256=r.content->>'image_sha256';
 end if;
 update public.novori_content_screenings set state=p_decision,reason=trim(p_reason),decided_by=p_actor,updated_at=now(),expires_at=now()+interval '7 days' where id=p_id;
 update public.novori_screening_alerts set status='cancelled' where screening_id=p_id and status='pending';
 insert into public.novori_admin_audit(request_id,request_hash,actor_id,action,target_type,target_id,reason,result)
 values(p_request,md5(p_id::text||p_decision||p_reason),p_actor,'screening_'||p_decision,'screening',p_id,trim(p_reason),jsonb_build_object('completed',true));
 insert into public.notifications(recipient_id,type,title,body) values(r.user_id,'system','Content review update',case when p_decision='approved' and r.surface like 'legacy-media:%' then 'Your image was approved and its delivery restored.' when p_decision='approved' then 'Your submission was approved. Open your draft and submit the same content again.' else 'Your submission was not approved. Edit it before submitting again.' end||E'\n\n'||trim(p_reason)||E'\n\nAppeals: support@novori.link');
 return jsonb_build_object('completed',true);
end$$;
-- Distinct reporters prevent one account repeatedly escalating an item.
create or replace view public.novori_report_priority with (security_invoker=true) as
 with counts as (select target_type,target_id,count(distinct reporter_id) filter(where status in ('pending','reviewed'))::integer as distinct_reporters,
 bool_or(reason in ('child_safety','child_exploitation','credible_threat')) filter(where status in ('pending','reviewed')) as safety_urgent,
 min(created_at) filter(where status in ('pending','reviewed')) as first_open_report
 from public.content_reports group by target_type,target_id)
 select r.id,r.target_type,r.target_id,r.reason,r.status,r.created_at,r.updated_at,c.distinct_reporters,c.first_open_report,
 case when c.safety_urgent or c.distinct_reporters>=5 then 3 when c.distinct_reporters>=3 then 2 else 1 end as priority_rank,
 case when c.safety_urgent or c.distinct_reporters>=5 then 'urgent' when c.distinct_reporters>=3 then 'high' else 'normal' end as priority
 from public.content_reports r join counts c using(target_type,target_id);
revoke all on public.novori_report_priority from public,anon,authenticated;
grant select on public.novori_report_priority to service_role;
do $$declare sig text;begin
 foreach sig in array array['novori_claim_screening(uuid,text)','novori_record_screening(uuid,text,text,jsonb,boolean,jsonb,text,text)','novori_issue_publication_ticket(uuid,text,text,text)','novori_admin_review_screening(uuid,uuid,timestamptz,text,text,uuid)'] loop
 execute 'revoke all on function public.'||sig||' from public,anon,authenticated';execute 'grant execute on function public.'||sig||' to service_role';end loop;
end$$;
revoke all on function public.novori_publication_guard() from public,anon,authenticated;

-- Content-free emails reuse the existing admin worker and Resend setup.
create table if not exists public.novori_screening_alerts(
 id uuid primary key default gen_random_uuid(),screening_id uuid not null references public.novori_content_screenings(id) on delete cascade,
 admin_id uuid not null references auth.users(id) on delete cascade,status text not null default 'pending',
 claim_token uuid,lease_until timestamptz,attempts integer not null default 0,created_at timestamptz not null default now(),unique(screening_id,admin_id)
);
alter table public.novori_screening_alerts enable row level security;
revoke all on public.novori_screening_alerts from public,anon,authenticated;
grant select,insert,update,delete on public.novori_screening_alerts to service_role;
create or replace function public.novori_queue_screening_alert() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if new.state='pending' then insert into public.novori_screening_alerts(screening_id,admin_id)
 select new.id,user_id from public.novori_admin_members where enabled and email_alerts on conflict do nothing;end if;return new;
end$$;
drop trigger if exists novori_queue_screening_alert on public.novori_content_screenings;
create trigger novori_queue_screening_alert after insert or update on public.novori_content_screenings for each row execute function public.novori_queue_screening_alert();
create or replace function public.novori_claim_screening_alert() returns jsonb
language plpgsql security definer set search_path='' as $$declare a public.novori_screening_alerts;token uuid:=gen_random_uuid();begin
 select q.* into a from public.novori_screening_alerts q join public.novori_admin_members m on m.user_id=q.admin_id join public.novori_content_screenings s on s.id=q.screening_id
 where m.enabled and m.email_alerts and s.state='pending' and (q.status='pending' or(q.status='processing' and q.lease_until<now()))
 order by s.priority_rank desc,q.created_at for update of q skip locked limit 1;
 if not found then return null;end if;
 update public.novori_screening_alerts set status='processing',claim_token=token,lease_until=now()+interval '2 minutes',attempts=attempts+1 where id=a.id;
 return to_jsonb(a)||jsonb_build_object('claim_token',token,'kind','screening');
end$$;
create or replace function public.novori_finish_screening_alert(p_id uuid,p_token uuid,p_success boolean) returns void
language plpgsql security definer set search_path='' as $$begin
 update public.novori_screening_alerts set status=case when p_success then 'completed' else 'pending' end,claim_token=null,lease_until=null where id=p_id and claim_token=p_token and status='processing';
 if not found then raise exception using errcode='40001',message='Alert lease changed';end if;
end$$;
revoke all on function public.novori_queue_screening_alert(),public.novori_claim_screening_alert(),public.novori_finish_screening_alert(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.novori_claim_screening_alert(),public.novori_finish_screening_alert(uuid,uuid,boolean) to service_role;

-- Image objects remain at stable paths. Activation makes these buckets private;
-- authenticated direct uploads/overwrites are then forbidden independently of RLS.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('moderation-quarantine','moderation-quarantine',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false;
create or replace function public.novori_storage_publication_guard() returns trigger
language plpgsql security definer set search_path='' as $$declare claims jsonb;begin
 if new.bucket_id not in ('avatars','post-media','club-covers','moderation-quarantine') then return new;end if;
 if new.bucket_id<>'moderation-quarantine' and not exists(select 1 from public.novori_moderation_config where enforcement_enabled) then return new;end if;
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
 if coalesce(claims->>'role',current_setting('request.jwt.claim.role',true))='service_role' then return new;end if;
 if claims='{}'::jsonb and auth.uid() is null and session_user not in ('authenticator','supabase_storage_admin') then return new;end if;
 raise exception using errcode='42501',message='Images must pass Novori safety checks before upload.';
end$$;
drop trigger if exists novori_storage_publication_guard on storage.objects;
create trigger novori_storage_publication_guard before insert or update on storage.objects for each row execute function public.novori_storage_publication_guard();
revoke all on function public.novori_storage_publication_guard() from public,anon,authenticated;

-- Private visibility alone is insufficient if older SELECT policies let any
-- signed-in reader download/sign arbitrary objects. Keep media delivery on the
-- protected route and quarantine available only to service-authorized reviewers.
create or replace function public.novori_user_storage_read_allowed(p_bucket text) returns boolean
language sql stable security definer set search_path='' as $$
 select case when p_bucket='moderation-quarantine' then false
 when p_bucket in ('avatars','post-media','club-covers') then not exists(select 1 from public.novori_moderation_config where enforcement_enabled)
 else true end
$$;
revoke all on function public.novori_user_storage_read_allowed(text) from public;
grant execute on function public.novori_user_storage_read_allowed(text) to anon,authenticated,service_role;
alter table storage.objects enable row level security;
drop policy if exists novori_moderated_media_only on storage.objects;
create policy novori_moderated_media_only on storage.objects as restrictive for select to anon,authenticated using(public.novori_user_storage_read_allowed(bucket_id));

-- Signup uses one-use receipts bound to the exact email/profile names. No password
-- is stored in these tables or submitted to moderation. Auth consumes/removes the
-- receipt before storing metadata; direct old-client signup fails after activation.
create table if not exists public.novori_registration_tickets(
 id uuid primary key default gen_random_uuid(),email text not null,names jsonb not null,version text not null,
 expires_at timestamptz not null default now()+interval '60 seconds'
);
create table if not exists public.novori_registration_limits(
 key text primary key,window_start timestamptz not null,requests integer not null
);
alter table public.novori_registration_tickets enable row level security;
alter table public.novori_registration_limits enable row level security;
revoke all on public.novori_registration_tickets,public.novori_registration_limits from public,anon,authenticated;
grant select,insert,update,delete on public.novori_registration_tickets,public.novori_registration_limits to service_role;
create or replace function public.novori_claim_registration(p_email text) returns boolean
language plpgsql security definer set search_path='' as $$declare key_value text;n integer;allowed boolean:=true;begin
 foreach key_value in array array['global',p_email] loop
 insert into public.novori_registration_limits(key,window_start,requests) values(key_value,now(),1)
 on conflict(key) do update set requests=case when novori_registration_limits.window_start<now()-interval '1 minute' then 1 else novori_registration_limits.requests+1 end,
 window_start=case when novori_registration_limits.window_start<now()-interval '1 minute' then now() else novori_registration_limits.window_start end returning requests into n;
 allowed:=allowed and n<=case when key_value='global' then 60 else 3 end;
 end loop;
 return allowed;
end$$;
create or replace function public.novori_issue_registration_ticket(p_email text,p_names jsonb,p_version text) returns uuid
language plpgsql security definer set search_path='' as $$declare token uuid;begin
 delete from public.novori_registration_tickets where expires_at<now();
 insert into public.novori_registration_tickets(email,names,version) values(p_email,p_names,p_version) returning id into token;return token;
end$$;
create or replace function public.novori_registration_guard() returns trigger
language plpgsql security definer set search_path='' as $$declare token uuid;r public.novori_registration_tickets;meta jsonb;begin
 meta:=coalesce(new.raw_user_meta_data,'{}'::jsonb);
 if tg_op='UPDATE' then
 if not exists(select 1 from public.novori_moderation_config where enforcement_enabled) or (meta->'username' is not distinct from old.raw_user_meta_data->'username' and meta->'display_name' is not distinct from old.raw_user_meta_data->'display_name') then return new;end if;
 raise exception using errcode='42501',message='Edit your profile names through the Novori profile editor.';end if;
 if not exists(select 1 from public.novori_moderation_config where enforcement_enabled) and not (meta ? 'novori_registration_ticket') then return new;end if;
 begin token:=(meta->>'novori_registration_ticket')::uuid;exception when others then token:=null;end;
 delete from public.novori_registration_tickets where id=token and expires_at>now() and email=lower(trim(new.email))
 and names=jsonb_build_object('username',meta->>'username','display_name',meta->>'display_name')
 and version=meta->>'terms_version' and version=meta->>'privacy_version' and meta->'adult_confirmed'='true'::jsonb returning * into r;
 if not found then raise exception using errcode='42501',message='Create your account using the updated Novori signup flow.';end if;
 new.raw_user_meta_data:=meta-'novori_registration_ticket';return new;
end$$;
drop trigger if exists novori_registration_guard on auth.users;
create trigger novori_registration_guard before insert or update on auth.users for each row execute function public.novori_registration_guard();
revoke all on function public.novori_registration_guard() from public,anon,authenticated;
revoke all on function public.novori_claim_registration(text),public.novori_issue_registration_ticket(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.novori_claim_registration(text),public.novori_issue_registration_ticket(text,jsonb,text) to service_role;


-- Removing a photo post also revokes delivery of its original image URL.
create or replace function public.novori_block_deleted_post_media() returns trigger
language plpgsql security definer set search_path='' as $$declare object_path text;claims jsonb;begin
 if old.post_image_url is not null then
 object_path:=split_part(regexp_replace(old.post_image_url,'^https://[^/]+/storage/v1/object/public/post-media/',''),'?',1);
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
 if claims->>'role'='service_role' or (auth.uid() is null and coalesce(current_setting('request.path',true),'')='') then
 insert into public.novori_blocked_image_hashes(user_id,sha256,reason) select user_id,sha256,'Removed by moderation' from public.novori_moderated_media where bucket='post-media' and path=object_path on conflict do nothing;end if;
 update public.novori_moderated_media set blocked=true where bucket='post-media' and path=object_path;
 end if;return old;
end$$;
drop trigger if exists novori_block_deleted_post_media on public.posts;
create trigger novori_block_deleted_post_media before delete on public.posts for each row execute function public.novori_block_deleted_post_media();
revoke all on function public.novori_block_deleted_post_media() from public,anon,authenticated;
create or replace function public.novori_admin_block_reported_image(p_actor uuid,p_report uuid,p_expected timestamptz,p_reason text,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare r public.content_reports;image text;b text;p text;prior public.novori_admin_audit;hash text;begin
 if not exists(select 1 from public.novori_admin_members where user_id=p_actor and enabled and role in ('owner','moderator')) or public.novori_reader_restricted(p_actor) or not public.novori_account_active(p_actor) then raise exception using errcode='42501',message='Moderator required';end if;
 if p_request is null or coalesce(length(trim(p_reason)),0)<5 or length(p_reason)>1000 then raise exception 'Reason required';end if;
 hash:=md5(jsonb_build_object('report',p_report,'reason',p_reason,'expected',p_expected)::text);
 select * into prior from public.novori_admin_audit where request_id=p_request;
 if found then if prior.actor_id<>p_actor or prior.request_hash<>hash then raise exception 'Request changed';end if;return prior.result;end if;
 select * into r from public.content_reports where id=p_report for update;
 if not found or r.updated_at is distinct from p_expected then raise exception using errcode='40001',message='Report changed. Refresh.';end if;
 if r.target_type='post' then select post_image_url into image from public.posts where id=r.target_id;b:='post-media';
 elsif r.target_type='profile' then select avatar_url into image from public.profiles where id=r.target_id;b:='avatars';
 else raise exception 'Report has no image';end if;
 if image is null then raise exception 'Image already removed';end if;
 p:=split_part(regexp_replace(image,'^https://[^/]+/storage/v1/object/public/'||b||'/',''),'?',1);
 insert into public.novori_blocked_image_hashes(user_id,sha256,reason) select user_id,sha256,trim(p_reason) from public.novori_moderated_media where bucket=b and path=p on conflict(user_id,sha256) do update set reason=excluded.reason;
 update public.novori_moderated_media set blocked=true where bucket=b and path=p;
 if r.target_type='post' then update public.posts set post_image_url=null where id=r.target_id;
 else update public.profiles set avatar_url=null where id=r.target_id;end if;
 update public.content_reports set status='actioned',updated_at=now() where id=p_report;
 insert into public.novori_admin_audit(request_id,request_hash,actor_id,action,target_type,target_id,reason,result)
 values(p_request,hash,p_actor,'block_reported_image','report',p_report,trim(p_reason),jsonb_build_object('completed',true));
 return jsonb_build_object('completed',true);
end$$;
revoke all on function public.novori_admin_block_reported_image(uuid,uuid,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function public.novori_admin_block_reported_image(uuid,uuid,timestamptz,text,uuid) to service_role;

commit;
