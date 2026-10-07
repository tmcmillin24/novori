begin;
alter table public.posts add column if not exists contains_spoilers boolean not null default false;
create table if not exists public.novori_club_media_cleanup (
 bucket text not null check (bucket='club-covers'), path text not null,
 created_at timestamptz not null default now(), primary key(bucket,path)
);
alter table public.novori_club_media_cleanup enable row level security;
revoke all on public.novori_club_media_cleanup from anon, authenticated;
grant all on public.novori_club_media_cleanup to service_role;
create or replace function public.novori_delete_club(p_club_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to delete a club.' using errcode='42501'; end if;
 if not public.novori_account_active(auth.uid()) or public.novori_reader_restricted(auth.uid()) then raise exception 'Account access is restricted.' using errcode='42501';end if;
 select owner_id into owner from public.clubs where id=p_club_id for update;
 if not found then raise exception 'This club is no longer available.'; end if;
 if owner is distinct from auth.uid() then raise exception 'Only the club owner can delete this club.' using errcode='42501'; end if;
 insert into public.novori_club_media_cleanup(bucket,path)
 select bucket,path from public.novori_moderated_media
 where bucket='club-covers' and split_part(path,'/',2)=p_club_id::text on conflict do nothing;
 delete from public.novori_moderated_media where bucket='club-covers' and split_part(path,'/',2)=p_club_id::text;
 delete from public.clubs where id=p_club_id;
end$$;
revoke all on function public.novori_delete_club(uuid) from public,anon;
grant execute on function public.novori_delete_club(uuid) to authenticated;
-- Preserve the installed Reading Update transaction and its default arguments.
-- The wrapper adds the spoiler flag in the same transaction, before publication commits.
create or replace function public.novori_publish_reading_update(p_input jsonb,p_spoilers boolean default false) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare f record; arg text; i integer; args text[] := '{}'; result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to publish.' using errcode='42501';end if;
 if jsonb_typeof(p_input) <> 'object' then raise exception 'Invalid reading update.';end if;
 select p.oid,p.proargnames,p.proargtypes,p.pronargs into strict f
 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='publish_reading_update_to_destination';
 for i in 0..f.pronargs-1 loop
  arg:=f.proargnames[i+1];
  if p_input ? arg then
   args:=array_append(args,format('%I => %L::%s',arg,p_input->>arg,pg_catalog.format_type(f.proargtypes[i],null)));
  end if;
 end loop;
 execute 'select public.publish_reading_update_to_destination('||array_to_string(args,',')||')' into result;
 update public.posts set contains_spoilers=coalesce(p_spoilers,false) where id=result and author_id=auth.uid();
 if not found then raise exception 'Reading update was not published.';end if;
 return result;
end$$;
revoke all on function public.novori_publish_reading_update(jsonb,boolean) from public,anon;
grant execute on function public.novori_publish_reading_update(jsonb,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
