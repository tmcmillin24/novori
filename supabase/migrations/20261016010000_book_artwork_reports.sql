-- Additive report intake only. Never modifies catalog metadata, artwork or caches.
begin;
create table public.book_artwork_reports (
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null references public.book_works(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 book_id text not null, title text not null, authors jsonb not null default '[]',
 cover_url text check(cover_url is null or (length(cover_url)<=2048 and cover_url ~ '^https://')),
 reason text not null check(reason in ('wrong_cover','blurry_cover','missing_cover')),
 status text not null default 'pending' check(status in ('pending','resolved','dismissed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz, resolution_note text,
 unique(work_id,reporter_id)
);
create index book_artwork_reports_queue on public.book_artwork_reports(status,updated_at);
create index book_artwork_reports_reader on public.book_artwork_reports(reporter_id,created_at);
alter table public.book_artwork_reports enable row level security;
revoke all on public.book_artwork_reports from public,anon,authenticated;
grant all on public.book_artwork_reports to service_role;

create function public.submit_book_artwork_report(p_book_id text,p_reason text,p_cover_url text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare reader uuid:=auth.uid(); edition public.book_editions; report_id uuid;
begin
 if reader is null or not public.novori_account_active(reader) or public.novori_reader_restricted(reader) then
  raise exception using errcode='42501',message='Sign in with an active account to report a cover.';
 end if;
 if p_book_id is null or length(p_book_id)>200 or p_reason is null or p_reason not in ('wrong_cover','blurry_cover','missing_cover') then
  raise exception using errcode='22023',message='Choose a valid book and cover issue.';
 end if;
 if p_cover_url is not null and (length(p_cover_url)>2048 or p_cover_url !~ '^https://') then
  raise exception using errcode='22023',message='Invalid cover URL.';
 end if;
 select * into edition from public.book_editions where provider_book_id=p_book_id
 order by case provider when 'isbndb' then 0 else 1 end,id limit 1;
 if edition.id is null then
  raise exception using errcode='P0002',message='This book listing is not available for reporting yet. Please reopen it and try again.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('book-report-reader:'||reader::text,0));
 perform pg_advisory_xact_lock(hashtextextended('book-report-work:'||edition.work_id::text,0));
 if not exists(select 1 from public.book_artwork_reports where work_id=edition.work_id and reporter_id=reader)
 and (select count(*) from public.book_artwork_reports where reporter_id=reader and created_at>now()-interval '1 day')>=20 then
  raise exception using errcode='22023',message='You have reached today’s book report limit. Please try again tomorrow.';
 end if;
 insert into public.book_artwork_reports as r(work_id,reporter_id,book_id,title,authors,cover_url,reason)
 values(edition.work_id,reader,p_book_id,coalesce(edition.metadata#>>'{volumeInfo,title}','Untitled'),
 case when jsonb_typeof(edition.metadata#>'{volumeInfo,authors}')='array' then edition.metadata#>'{volumeInfo,authors}' else '[]'::jsonb end,p_cover_url,p_reason)
 on conflict(work_id,reporter_id) do update set reason=excluded.reason,cover_url=excluded.cover_url,
 book_id=excluded.book_id,status='pending',updated_at=clock_timestamp(),reviewed_by=null,reviewed_at=null,resolution_note=null
 where r.reason is distinct from excluded.reason or r.cover_url is distinct from excluded.cover_url or r.status<>'pending'
 returning id into report_id;
 if report_id is null then select id into report_id from public.book_artwork_reports where work_id=edition.work_id and reporter_id=reader;end if;
 return report_id;
end$$;
revoke all on function public.submit_book_artwork_report(text,text,text) from public,anon;
grant execute on function public.submit_book_artwork_report(text,text,text) to authenticated;

create view public.novori_book_artwork_report_queue with(security_invoker=true) as
select work_id,min(title) as title,
 (array_agg(book_id order by updated_at desc,id))[1] as book_id,
 (array_agg(authors order by updated_at desc,id))[1] as authors,
 (array_remove(array_agg(cover_url order by updated_at desc,id),null))[1] as reported_cover_url,
 count(*)::integer as report_count,
 count(*) filter(where status='pending')::integer as pending_count,
 count(*) filter(where reason='wrong_cover')::integer as wrong_cover_count,
 count(*) filter(where reason='blurry_cover')::integer as blurry_cover_count,
 count(*) filter(where reason='missing_cover')::integer as missing_cover_count,
 case when bool_or(status='pending') then 'pending' else (array_agg(status order by updated_at desc,id))[1] end as status,
 max(updated_at) as updated_at,
 md5(string_agg(id::text||updated_at::text||status||reason||coalesce(cover_url,''),'|' order by id)) as revision
from public.book_artwork_reports group by work_id;
revoke all on public.novori_book_artwork_report_queue from public,anon,authenticated;
grant select on public.novori_book_artwork_report_queue to service_role;

create function public.novori_admin_review_book_artwork(p_actor uuid,p_work uuid,p_expected text,p_decision text,p_reason text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.novori_admin_audit; request_hash text; revision text; result jsonb; changed integer;
begin
 if not exists(select 1 from public.novori_admin_members where user_id=p_actor and enabled and role in ('owner','moderator'))
 or not public.novori_account_active(p_actor) or public.novori_reader_restricted(p_actor) then
  raise exception using errcode='42501',message='Moderator access required.';
 end if;
 if p_request is null or p_decision is null or p_decision not in ('resolved','dismissed') or p_reason is null or length(trim(p_reason)) not between 5 and 1000 or p_expected is null then
  raise exception using errcode='22023',message='A decision, revision, request ID and reason are required.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('book-report-request:'||p_request::text,0));
 request_hash:=md5(jsonb_build_array(p_actor,p_work,p_expected,p_decision,trim(p_reason))::text);
 select * into previous from public.novori_admin_audit where request_id=p_request;
 if previous.id is not null then
  if previous.request_hash<>request_hash then raise exception using errcode='22023',message='Request ID already used.';end if;
  return previous.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('book-report-work:'||p_work::text,0));
 select q.revision into revision from public.novori_book_artwork_report_queue q where q.work_id=p_work;
 if revision is null then raise exception using errcode='P0002',message='Book reports no longer exist.';end if;
 if revision<>p_expected then raise exception using errcode='40001',message='Reports changed. Refresh before deciding.';end if;
 update public.book_artwork_reports set status=p_decision,reviewed_by=p_actor,reviewed_at=now(),resolution_note=trim(p_reason),updated_at=clock_timestamp()
 where work_id=p_work and status='pending';
 get diagnostics changed=row_count;
 if changed=0 then raise exception using errcode='40001',message='No pending reports remain.';end if;
 result:=jsonb_build_object('work_id',p_work,'status',p_decision,'reports_updated',changed);
 insert into public.novori_admin_audit(request_id,request_hash,actor_id,action,target_type,target_id,reason,result)
 values(p_request,request_hash,p_actor,'review_book_artwork','book',p_work,trim(p_reason),result);
 return result;
end$$;
revoke all on function public.novori_admin_review_book_artwork(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.novori_admin_review_book_artwork(uuid,uuid,text,text,text,uuid) to service_role;
commit;
