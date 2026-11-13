begin;
-- Stop cleanly on an unexpected legacy signature rather than changing it blindly.
do $$ begin
 if to_regprocedure('public.delete_post_comment(uuid)') is null then raise exception 'Existing delete_post_comment(uuid) is missing'; end if;
 if pg_get_function_result('public.delete_post_comment(uuid)'::regprocedure)<>'void' then
  raise exception 'Unexpected delete_post_comment return type; inspect the existing function before rollout';
 end if;
end $$;
create or replace function public.delete_post_comment(target_comment_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare reader uuid:=auth.uid(); owner_id uuid;
begin
 if reader is null or not public.novori_account_active(reader) or public.novori_reader_restricted(reader) then
  raise exception 'Account unavailable' using errcode='42501';
 end if;
 select author_id into owner_id from public.post_comments where id=target_comment_id for update;
 if not found or owner_id is null then return; end if;
 if owner_id is distinct from reader then raise exception 'Only the author can delete this comment' using errcode='42501'; end if;
 -- Never physically delete a parent: a concurrent reply must not be cascaded away.
 -- Readers prune empty tombstones; surviving replies keep their original ancestry.
 update public.post_comments set author_id=null,body='This comment was deleted.',updated_at=now() where id=target_comment_id;
 delete from public.notifications where (entity_type='comment' and entity_id::text=target_comment_id::text) or metadata->>'comment_id'=target_comment_id::text;
end $$;
revoke all on function public.delete_post_comment(uuid) from public,anon;
grant execute on function public.delete_post_comment(uuid) to authenticated;
commit;
