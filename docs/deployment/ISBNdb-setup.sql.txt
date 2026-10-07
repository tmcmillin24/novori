begin;

-- Some earlier installations restrict the provider column to named sources.
-- Expand only single-column provider checks, retaining every other constraint.
do $$declare c record;begin
 for c in
  select n.nspname,t.relname,k.conname,pg_catalog.pg_get_expr(k.conbin,k.conrelid) expression
  from pg_catalog.pg_constraint k
  join pg_catalog.pg_class t on t.oid=k.conrelid
  join pg_catalog.pg_namespace n on n.oid=t.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attname='provider'
  where n.nspname='public' and t.relname in
   ('book_api_cache','api_usage_daily','book_editions','book_cover_candidates','api_cache_refresh_locks')
   and k.contype='c' and k.conkey=array[a.attnum]
   and pg_catalog.pg_get_expr(k.conbin,k.conrelid) not like '%isbndb%'
 loop
  execute format('alter table %I.%I drop constraint %I',c.nspname,c.relname,c.conname);
  execute format('alter table %I.%I add constraint %I check ((%s) or provider = ''isbndb'')',c.nspname,c.relname,c.conname,c.expression);
 end loop;
end$$;

-- Additive identity aliases: existing reader-owned rows are never re-keyed.
create table if not exists public.novori_book_provider_ids (
 isbn13 text primary key check (isbn13 ~ '^(978|979)[0-9]{10}$'),
 book_id text not null,
 created_at timestamptz not null default now()
);
create index if not exists novori_book_provider_ids_book_id on public.novori_book_provider_ids(book_id);
create table if not exists public.novori_isbndb_usage_daily (
 usage_date date primary key,
 upstream_requests bigint not null default 0,
 last_request_at timestamptz,
 next_request_at timestamptz not null default '-infinity'
);
create table if not exists public.novori_isbndb_user_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 usage_date date not null,
 upstream_requests integer not null default 0,
 primary key(user_id, usage_date)
);
alter table public.novori_book_provider_ids enable row level security;
alter table public.novori_isbndb_usage_daily enable row level security;
alter table public.novori_isbndb_user_usage enable row level security;
revoke all on public.novori_book_provider_ids,public.novori_isbndb_usage_daily,public.novori_isbndb_user_usage from public,anon,authenticated;
grant select,insert,update on public.novori_book_provider_ids,public.novori_isbndb_usage_daily,public.novori_isbndb_user_usage to service_role;

create or replace function public.novori_claim_isbndb_request(p_user_id uuid default null)
returns table(allowed boolean,reason text,retry_ms integer)
language plpgsql security definer set search_path='' as $$
declare
 recorded_at timestamptz;
 day_key date;
 quota public.novori_isbndb_usage_daily%rowtype;
 user_requests integer;
begin
 recorded_at:=clock_timestamp();
 day_key:=(recorded_at at time zone 'UTC')::date;
 -- Serialize across Edge Function instances, including the UTC midnight boundary.
 perform pg_catalog.pg_advisory_xact_lock(731985042);
 recorded_at:=clock_timestamp();
 day_key:=(recorded_at at time zone 'UTC')::date;
 insert into public.novori_isbndb_usage_daily(usage_date) values(day_key) on conflict do nothing;
 select * into quota from public.novori_isbndb_usage_daily where usage_date=day_key for update;
 if quota.upstream_requests>=4500 then return query select false,'daily_quota'::text,0; return; end if;
 -- Retain a global 1.1 second spacing even on a new UTC day.
 if exists(select 1 from public.novori_isbndb_usage_daily where next_request_at>recorded_at) then
  return query select false,'rate_limit'::text,
   greatest(100,ceil(extract(epoch from (max(next_request_at)-recorded_at))*1000)::integer)
   from public.novori_isbndb_usage_daily where next_request_at>recorded_at;
  return;
 end if;
 if p_user_id is not null then
  insert into public.novori_isbndb_user_usage(user_id,usage_date) values(p_user_id,day_key) on conflict do nothing;
  select upstream_requests into user_requests from public.novori_isbndb_user_usage where user_id=p_user_id and usage_date=day_key for update;
  if user_requests>=250 then return query select false,'reader_daily_quota'::text,0; return; end if;
  update public.novori_isbndb_user_usage set upstream_requests=upstream_requests+1 where user_id=p_user_id and usage_date=day_key;
 end if;
 update public.novori_isbndb_usage_daily set upstream_requests=upstream_requests+1,
  last_request_at=recorded_at,next_request_at=recorded_at+interval '1.1 seconds' where usage_date=day_key;
 return query select true,null::text,0;
end$$;
revoke all on function public.novori_claim_isbndb_request(uuid) from public,anon,authenticated;
grant execute on function public.novori_claim_isbndb_request(uuid) to service_role;

commit;
