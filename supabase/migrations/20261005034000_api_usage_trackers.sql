begin;
-- Separate from Google's existing quota counter; no cache or quota rules change.
create table if not exists public.novori_api_usage_tracking (
 provider text primary key check (provider='hardcover'),
 enabled_at timestamptz not null default now(),
 first_request_at timestamptz,
 last_request_at timestamptz
);
create table if not exists public.novori_api_usage_daily (
 provider text not null check (provider='hardcover'),
 usage_date date not null,
 upstream_requests bigint not null default 0 check(upstream_requests>=0),
 primary key(provider,usage_date)
);
alter table public.novori_api_usage_tracking enable row level security;
alter table public.novori_api_usage_daily enable row level security;
revoke all on public.novori_api_usage_tracking,public.novori_api_usage_daily from public,anon,authenticated;
grant select,insert,update on public.novori_api_usage_tracking,public.novori_api_usage_daily to service_role;
insert into public.novori_api_usage_tracking(provider) values('hardcover') on conflict do nothing;
create or replace function public.novori_record_hardcover_request() returns void
language plpgsql security definer set search_path='' as $$
declare recorded_at timestamptz:=clock_timestamp();begin
 insert into public.novori_api_usage_daily(provider,usage_date,upstream_requests)
 values('hardcover',(recorded_at at time zone 'UTC')::date,1)
 on conflict(provider,usage_date) do update
 set upstream_requests=public.novori_api_usage_daily.upstream_requests+1;
 update public.novori_api_usage_tracking
 set first_request_at=coalesce(first_request_at,recorded_at),
 last_request_at=greatest(last_request_at,recorded_at) where provider='hardcover';
end$$;
revoke all on function public.novori_record_hardcover_request() from public,anon,authenticated;
grant execute on function public.novori_record_hardcover_request() to service_role;
commit;
