begin;
create table if not exists public.book_edition_page_facts (
 isbn_13 text primary key check (isbn_13 ~ '^(978|979)[0-9]{10}$'),
 title text not null, authors text[] not null,
 page_count integer not null check (page_count between 1 and 100000),
 source_url text not null, checked_at timestamptz not null default now()
);
alter table public.book_edition_page_facts enable row level security;
revoke all on public.book_edition_page_facts from public,anon,authenticated;
grant select,insert,update,delete on public.book_edition_page_facts to service_role;

-- Bibliographic fact verified against the publisher/distributor's exact paperback.
-- This is not an artwork ISBN or a count copied from another printing.
insert into public.book_edition_page_facts(isbn_13,title,authors,page_count,source_url)
values ('9781496764751','A Fate So Dark and Delicate',array['Sophia St. Germain'],480,
 'https://www.penguinrandomhouse.com/books/834174/a-fate-so-dark-and-delicate-by-sophia-st-germain/')
on conflict(isbn_13) do nothing;

create or replace function public.novori_positive_page_count(value text)
returns integer language sql immutable set search_path = '' as $$
 select case when value ~ '^[0-9]{1,6}$' then
  case when value::integer between 1 and 100000 then value::integer end end
$$;
revoke all on function public.novori_positive_page_count(text) from public,anon,authenticated;

-- Backend-only, exact edition update. JSON paths preserve covers and every other field.
create or replace function public.novori_store_edition_pages(
 p_book_id text,p_isbn text,p_page_count integer
) returns integer language plpgsql security definer set search_path = '' as $$
declare row_id public.book_editions.id%type; chosen integer;
begin
 if p_page_count is null or p_page_count not between 1 and 100000 then return null; end if;
 select e.id,coalesce(public.novori_positive_page_count(e.metadata#>>'{volumeInfo,pageCount}'),
  case when e.page_count between 1 and 100000 then e.page_count end,p_page_count)
 into row_id,chosen from public.book_editions e
 where e.provider in ('isbndb','google_books') and e.provider_book_id=p_book_id and e.isbn_13=p_isbn
  and jsonb_typeof(e.metadata->'volumeInfo')='object'
  and coalesce(e.metadata#>>'{novoriEdition,format}','') <> 'audio'
 order by (e.provider='isbndb') desc limit 1 for update;
 if row_id is null then return null; end if;
 update public.book_editions e set page_count=chosen,
  metadata=jsonb_set(e.metadata,'{volumeInfo,pageCount}',to_jsonb(chosen),true)
 where e.id=row_id and (e.page_count is distinct from chosen
  or e.metadata#>'{volumeInfo,pageCount}' is distinct from to_jsonb(chosen));
 update public.google_books_catalog c
 set metadata=jsonb_set(c.metadata,'{volumeInfo,pageCount}',to_jsonb(chosen),true)
 where c.google_book_id=p_book_id and jsonb_typeof(c.metadata->'volumeInfo')='object'
  and (c.metadata#>>'{source,isbn13}'=p_isbn or exists(
   select 1 from jsonb_array_elements(case when jsonb_typeof(c.metadata#>'{volumeInfo,industryIdentifiers}')='array' then c.metadata#>'{volumeInfo,industryIdentifiers}' else '[]'::jsonb end) ident
   where ident->>'type'='ISBN_13' and ident->>'identifier'=p_isbn))
  and c.metadata#>'{volumeInfo,pageCount}' is distinct from to_jsonb(chosen);
 return chosen;
end $$;
revoke all on function public.novori_store_edition_pages(text,text,integer) from public,anon,authenticated;
grant execute on function public.novori_store_edition_pages(text,text,integer) to service_role;

create or replace function public.novori_page_author_key(value text)
returns text language sql immutable set search_path = '' as $$
 select string_agg(word,' ' order by word) from regexp_split_to_table(lower(value),'[^a-z0-9]+') word where word <> ''
$$;
revoke all on function public.novori_page_author_key(text) from public,anon,authenticated;

-- Repair existing cached counts, including numeric strings. Source dates stay intact.
do $$
declare edition record; fact record;
begin
 for edition in select e.provider_book_id,e.isbn_13,
  coalesce(public.novori_positive_page_count(e.metadata#>>'{volumeInfo,pageCount}'),
   case when e.page_count between 1 and 100000 then e.page_count end) as pages
  from public.book_editions e where e.provider in ('isbndb','google_books') and e.isbn_13 is not null
 loop
  if edition.pages is not null then perform public.novori_store_edition_pages(edition.provider_book_id,edition.isbn_13,edition.pages); end if;
 end loop;
 for fact in select * from public.book_edition_page_facts loop
  for edition in select e.provider_book_id from public.book_editions e
   where e.isbn_13=fact.isbn_13 and e.provider in ('isbndb','google_books')
    and lower(e.metadata#>>'{volumeInfo,title}') like lower(fact.title)||'%'
    and exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(e.metadata#>'{volumeInfo,authors}')='array' then e.metadata#>'{volumeInfo,authors}' else '[]'::jsonb end) a(name)
     where exists(select 1 from unnest(fact.authors) wanted(name)
      where public.novori_page_author_key(a.name)=public.novori_page_author_key(wanted.name)))
  loop perform public.novori_store_edition_pages(edition.provider_book_id,fact.isbn_13,fact.page_count); end loop;
 end loop;
end $$;

create or replace function public.get_finished_book_page_totals(
  period_start date, period_end date, reader_timezone text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare reader_id uuid := auth.uid(); result jsonb;
begin
  if reader_id is null then raise exception 'Sign in to view reading insights.'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=reader_timezone) then
    raise exception 'Choose a valid IANA time zone.';
  end if;
  if period_start is null or period_end is null or period_start < date '1970-01-01'
    or period_end > date '9999-01-01' or period_end <= period_start or period_end-period_start > 366 then
    raise exception 'Choose a valid reading period.';
  end if;
  with completions as (
    select s.user_book_id from public.reading_sessions s
    where s.user_id=reader_id and s.journey_status='finished' and s.finished_at is not null
      and s.dnf_at is null and s.finished_at <= statement_timestamp()
      and s.finished_at >= (period_start::timestamp at time zone reader_timezone)
      and s.finished_at < (period_end::timestamp at time zone reader_timezone)
    union all
    select b.id from public.user_books b
    where b.user_id=reader_id and b.status='read' and b.finished_at is not null
      and b.dnf_at is null and b.finished_at <= statement_timestamp()
      and b.finished_at >= (period_start::timestamp at time zone reader_timezone)
      and b.finished_at < (period_end::timestamp at time zone reader_timezone)
      and not exists(select 1 from public.reading_sessions s where s.user_id=reader_id
        and s.user_book_id=b.id and s.journey_status='finished' and s.finished_at is not null and s.dnf_at is null)
  ), known_counts as (
    select edition.page_count from completions c
    join public.user_books b on b.id=c.user_book_id and b.user_id=reader_id
    join lateral (
      select e.page_count from public.book_editions e
      where e.provider in ('isbndb','google_books') and e.provider_book_id=b.google_book_id
        and e.page_count between 1 and 100000
        and coalesce(e.metadata#>>'{novoriEdition,format}','') <> 'audio'
      -- Catalog identity is unique. LIMIT also prevents inflated totals if an
      -- installation lacks the usual provider/edition unique constraint.
      order by (e.provider='isbndb') desc,e.provider_book_id limit 1
    ) edition on true
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'finishedBookPages',nullif((select sum(page_count::bigint) from known_counts),0),
    'finishedBooksWithPageCounts',nullif((select count(*) from known_counts),0)
  )) into result;
  return result;
end $$;
revoke all on function public.get_finished_book_page_totals(date,date,text) from public,anon;
grant execute on function public.get_finished_book_page_totals(date,date,text) to authenticated;


notify pgrst, 'reload schema';
commit;

