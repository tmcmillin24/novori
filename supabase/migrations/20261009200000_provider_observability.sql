begin;
create table if not exists public.novori_provider_request_log (
 id uuid primary key,provider text not null check(provider in ('hardcover','isbndb')),
 route text not null,started_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,status_code integer
);
create index if not exists novori_provider_request_log_time on public.novori_provider_request_log(started_at desc);
create table if not exists public.novori_provider_usage_observations (
 provider text not null,usage_date date not null,reported_used bigint not null,reported_limit bigint not null,
 remaining bigint not null,observed_at timestamptz not null,source text not null,
 primary key(provider,usage_date)
);
alter table public.novori_provider_request_log enable row level security;
alter table public.novori_provider_usage_observations enable row level security;
revoke all on public.novori_provider_request_log,public.novori_provider_usage_observations from public,anon,authenticated;
grant select,insert,update,delete on public.novori_provider_request_log,public.novori_provider_usage_observations to service_role;
create or replace function public.novori_begin_hardcover_request(p_request_id uuid,p_route text)
returns void language plpgsql security definer set search_path='' as $$
begin
 -- Record exactly once, atomically with the existing daily counter.
 insert into public.novori_provider_request_log(id,provider,route) values(p_request_id,'hardcover',left(p_route,100)) on conflict do nothing;
 if found then perform public.novori_record_hardcover_request();end if;
end$$;
create or replace function public.novori_begin_isbndb_request(p_user_id uuid,p_request_id uuid,p_route text)
returns table(allowed boolean,reason text,retry_ms integer)
language plpgsql security definer set search_path='' as $$
declare claim record;
begin
 if exists(select 1 from public.novori_provider_request_log where id=p_request_id) then
  return query select false,'duplicate_attempt'::text,0;return;
 end if;
 select * into claim from public.novori_claim_isbndb_request(p_user_id);
 if claim.allowed then insert into public.novori_provider_request_log(id,provider,route) values(p_request_id,'isbndb',left(p_route,100));end if;
 return query select claim.allowed,claim.reason,claim.retry_ms;
end$$;
create or replace function public.novori_store_provider_usage_observation(p_observation jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.novori_provider_usage_observations(provider,usage_date,reported_used,reported_limit,remaining,observed_at,source)
 values(p_observation->>'provider',(p_observation->>'usage_date')::date,(p_observation->>'reported_used')::bigint,
 (p_observation->>'reported_limit')::bigint,(p_observation->>'remaining')::bigint,(p_observation->>'observed_at')::timestamptz,p_observation->>'source')
 on conflict(provider,usage_date) do update set reported_used=excluded.reported_used,reported_limit=excluded.reported_limit,
 remaining=excluded.remaining,observed_at=excluded.observed_at,source=excluded.source
 where excluded.observed_at>public.novori_provider_usage_observations.observed_at
 and excluded.reported_used>=public.novori_provider_usage_observations.reported_used;
end$$;
revoke all on function public.novori_begin_hardcover_request(uuid,text),public.novori_begin_isbndb_request(uuid,uuid,text),public.novori_store_provider_usage_observation(jsonb) from public,anon,authenticated;
grant execute on function public.novori_begin_hardcover_request(uuid,text),public.novori_begin_isbndb_request(uuid,uuid,text),public.novori_store_provider_usage_observation(jsonb) to service_role;
-- Revalidation must not reset recorded cache-hit counters to zero.
create or replace function public.novori_preserve_cache_hit_history()
returns trigger language plpgsql set search_path='' as $$
begin
 new.hit_count:=greatest(coalesce(old.hit_count,0),coalesce(new.hit_count,0));
 new.last_hit_at:=greatest(old.last_hit_at,new.last_hit_at);return new;
end$$;
revoke all on function public.novori_preserve_cache_hit_history() from public,anon,authenticated;
grant execute on function public.novori_preserve_cache_hit_history() to service_role;
do $$begin
 if to_regclass('public.book_api_cache') is not null then
  drop trigger if exists novori_preserve_cache_hit_history on public.book_api_cache;
  create trigger novori_preserve_cache_hit_history before update on public.book_api_cache
   for each row execute function public.novori_preserve_cache_hit_history();
 end if;
end$$;
commit;
