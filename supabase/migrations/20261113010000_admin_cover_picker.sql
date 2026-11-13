begin;
create table if not exists public.novori_admin_cover_changes (
 id uuid primary key default gen_random_uuid(), work_id uuid not null references public.book_works(id),
 actor_id uuid not null, previous_selection jsonb, next_selection jsonb,
 reason text not null, created_at timestamptz not null default now()
);
alter table public.novori_admin_cover_changes enable row level security;
revoke all on public.novori_admin_cover_changes from public,anon,authenticated;
grant select,insert on public.novori_admin_cover_changes to service_role;
create or replace function public.novori_admin_set_book_cover(
 p_actor uuid,p_work uuid,p_expected text,p_url text,p_reason text,p_request uuid,p_undo uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_selection jsonb; new_selection jsonb; previous public.novori_admin_audit;
 change public.novori_admin_cover_changes; candidate uuid; edition uuid; provider_name text;
 fingerprint text; result jsonb; request_hash text;
begin
 if not exists(select 1 from public.novori_admin_members where user_id=p_actor and enabled and role in ('owner','moderator'))
 or not public.novori_account_active(p_actor) or public.novori_reader_restricted(p_actor) then
 raise exception using errcode='42501',message='Moderator access required.';end if;
 if p_request is null or p_expected is null or p_reason is null or length(trim(p_reason)) not between 5 and 1000 then
 raise exception using errcode='22023',message='A revision, reason and request ID are required.';end if;
 perform pg_advisory_xact_lock(hashtextextended('cover-request:'||p_request::text,0));
 request_hash:=md5(jsonb_build_array(p_actor,p_work,p_expected,p_url,trim(p_reason),p_undo)::text);
 select * into previous from public.novori_admin_audit where request_id=p_request;
 if previous.id is not null then
 if previous.request_hash<>request_hash then raise exception using errcode='22023',message='Request ID already used.';end if;
 return previous.result;end if;
 -- Lock the catalog work as well as the current selection before comparing revisions.
 perform 1 from public.book_works where id=p_work for update;
 if not found then raise exception using errcode='P0002',message='Book no longer exists.';end if;
 select to_jsonb(s) into old_selection from public.book_cover_selections s where work_id=p_work for update;
 fingerprint:=md5(coalesce(old_selection,'null'::jsonb)::text);
 if fingerprint<>p_expected then raise exception using errcode='40001',message='Cover changed. Refresh before saving.';end if;
 if p_undo is not null then
 select * into change from public.novori_admin_cover_changes where id=p_undo and work_id=p_work;
 if change.id is null or old_selection is distinct from change.next_selection then
 raise exception using errcode='40001',message='Only the unchanged last correction can be undone.';end if;
 if change.previous_selection is null then
 delete from public.book_cover_selections where work_id=p_work;
 else
 update public.book_cover_selections s set
 candidate_id=r.candidate_id,locked=r.locked,status=r.status,score=r.score,
 selector_version=r.selector_version,decision_json=r.decision_json
 from jsonb_populate_record(null::public.book_cover_selections,change.previous_selection) r where s.work_id=p_work;
 end if;
 else
 if p_url is null or length(p_url)>2048 or p_url !~ '^https://(images\.isbndb\.com|assets\.hardcover\.app|books\.google\.com|books\.googleusercontent\.com|covers\.openlibrary\.org)/[^[:space:]]+$'
 or p_url ~* '[?&](token|signature|expires|credential|imgtk)=' then
 raise exception using errcode='22023',message='Choose a stable image URL from a supported book provider.';end if;
 select id into edition from public.book_editions where work_id=p_work order by id limit 1;
 if edition is null then raise exception using errcode='P0002',message='No cached edition exists.';end if;
 provider_name:=case when p_url like 'https://images.isbndb.com/%' then 'isbndb' when p_url like 'https://assets.hardcover.app/%' then 'hardcover' else 'google_books' end;
 insert into public.book_cover_candidates(candidate_key,work_id,edition_id,scope,provider,source_kind,source_variant,external_id,url,discovery_source,source_metadata,last_seen_at)
 values('manual:admin:'||p_request::text,p_work,edition,'work',provider_name,'image_link','admin_manual',p_work::text,p_url,'admin_manual',jsonb_build_object('manual',true,'actor',p_actor),now()) returning id into candidate;
 insert into public.book_cover_selections(work_id,candidate_id,locked,status,selector_version,decision_json)
 values(p_work,candidate,true,'selected',6,jsonb_build_object('mode','manual','adminRequest',p_request))
 on conflict(work_id) do update set candidate_id=excluded.candidate_id,locked=true,status='selected',decision_json=excluded.decision_json;
 end if;
 select to_jsonb(s) into new_selection from public.book_cover_selections s where work_id=p_work;
 insert into public.novori_admin_cover_changes(work_id,actor_id,previous_selection,next_selection,reason)
 values(p_work,p_actor,old_selection,new_selection,trim(p_reason)) returning id into candidate;
 result:=jsonb_build_object('work_id',p_work,'change_id',candidate,'undone',p_undo is not null);
 insert into public.novori_admin_audit(request_id,request_hash,actor_id,action,target_type,target_id,reason,result)
 values(p_request,request_hash,p_actor,case when p_undo is null then 'set_book_cover' else 'undo_book_cover' end,'book',p_work,trim(p_reason),result);
 return result;
end$$;
revoke all on function public.novori_admin_set_book_cover(uuid,uuid,text,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.novori_admin_set_book_cover(uuid,uuid,text,text,text,uuid,uuid) to service_role;
create or replace function public.novori_admin_book_cover_options(p_work uuid)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'work_id',p_work,
 'revision',md5(coalesce((select to_jsonb(s) from public.book_cover_selections s where s.work_id=p_work),'null'::jsonb)::text),
 'selection',(select to_jsonb(s)||jsonb_build_object('url',c.url) from public.book_cover_selections s left join public.book_cover_candidates c on c.id=s.candidate_id where s.work_id=p_work),
 'candidates',coalesce((select jsonb_agg(to_jsonb(c)) from (select id,provider,url,edition_id,source_variant,source_metadata from public.book_cover_candidates where work_id=p_work order by last_seen_at desc,id limit 150)c),'[]'::jsonb),
 'editions',coalesce((select jsonb_agg(to_jsonb(e)) from (select id,provider,provider_book_id,isbn_13,metadata from public.book_editions where work_id=p_work order by id limit 150)e),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select id,reason,created_at,previous_selection,next_selection from public.novori_admin_cover_changes where work_id=p_work order by created_at desc,id limit 10)h),'[]'::jsonb)
 );
$$;
revoke all on function public.novori_admin_book_cover_options(uuid) from public,anon,authenticated;
grant execute on function public.novori_admin_book_cover_options(uuid) to service_role;
notify pgrst, 'reload schema';
commit;
