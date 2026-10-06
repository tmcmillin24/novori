-- Screen the entire RPC before executing it; all writes share one transaction.
create or replace function public.novori_save_book_stack(
  p_name text, p_items jsonb, p_stack_id uuid default null,
  p_publish boolean default false, p_body text default '',
  p_club_id uuid default null, p_post_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  reader uuid := auth.uid();
  stack_id uuid;
  stack_row public.book_stacks%rowtype;
  item jsonb;
  ordinal bigint;
begin
  if reader is null or not public.novori_account_active(reader)
     or public.novori_reader_restricted(reader) then
    raise exception using errcode='42501', message='Your account cannot publish. Contact support@novori.link.';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80 then
    raise exception 'Stack names must be between 1 and 80 characters.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid stack books.'; end if;
  if jsonb_array_length(p_items) not between 2 and 10 then raise exception 'Book Stacks need between 2 and 10 books.'; end if;
  if p_body is null or length(btrim(p_body)) > 4000 then raise exception 'Posts must be at most 4,000 characters.'; end if;
  if p_post_id is not null and (p_stack_id is null or not p_publish) then raise exception 'Invalid stack post.'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object' or coalesce(item->>'googleBookId','') = ''
       or coalesce(item->>'title','') = '' or jsonb_typeof(item->'authors') is distinct from 'array' then
      raise exception 'Invalid stack book.';
    end if;
    if exists(select 1 from jsonb_array_elements(item->'authors') a where jsonb_typeof(a) <> 'string') then raise exception 'Invalid book authors.'; end if;
  end loop;
  if (select count(distinct value->>'googleBookId') from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then
    raise exception 'Choose each book only once.';
  end if;
  if p_stack_id is null then
    insert into public.book_stacks(user_id,name,visibility) values(reader,btrim(p_name),'profile') returning * into stack_row;
    stack_id := stack_row.id;
  else
    select * into stack_row from public.book_stacks where id=p_stack_id and user_id=reader for update;
    if not found then raise exception using errcode='42501',message='This stack is not available to edit.'; end if;
    stack_id := stack_row.id;
    update public.book_stacks set name=btrim(p_name),updated_at=now() where id=stack_id and user_id=reader returning * into stack_row;
    delete from public.book_stack_items where book_stack_items.stack_id=stack_row.id;
  end if;
  for item,ordinal in select value, ordinality from jsonb_array_elements(p_items) with ordinality loop
    insert into public.book_stack_items(stack_id,google_book_id,title,authors,cover_url,position)
    values(stack_row.id,item->>'googleBookId',item->>'title',array(select jsonb_array_elements_text(item->'authors')),item->>'coverUrl',ordinal-1);
  end loop;
  if p_publish then
    if p_post_id is null then
      insert into public.posts(author_id,club_id,post_type,body,book_stack_id)
      values(reader,p_club_id,'book_stack',btrim(p_body),stack_row.id);
    else
      update public.posts set body=btrim(p_body),club_id=p_club_id,updated_at=now()
      where id=p_post_id and author_id=reader and book_stack_id=stack_row.id and post_type='book_stack';
      if not found then raise exception using errcode='42501',message='This stack post is not available to edit.'; end if;
    end if;
  end if;
  return to_jsonb(stack_row) || jsonb_build_object('items',(
    select coalesce(jsonb_agg(to_jsonb(i) order by i.position),'[]'::jsonb)
    from public.book_stack_items i where i.stack_id=stack_row.id
  ));
end $$;
revoke all on function public.novori_save_book_stack(text,jsonb,uuid,boolean,text,uuid,uuid) from public,anon;
grant execute on function public.novori_save_book_stack(text,jsonb,uuid,boolean,text,uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
