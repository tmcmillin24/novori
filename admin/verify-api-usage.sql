-- Read-only comparison with the admin dashboard. No counters are changed.
-- Run twice around a controlled app action to compare deltas, not historic totals.
with bounds as (
 select statement_timestamp() snapshot_at, (statement_timestamp() at time zone 'UTC')::date today
), counts as (
 select provider,usage_date,upstream_requests from public.api_usage_daily where provider='google_books'
 union all
 select provider,usage_date,upstream_requests from public.novori_api_usage_daily where provider='hardcover'
 union all
 select 'isbndb',usage_date,upstream_requests from public.novori_isbndb_usage_daily
), providers as (
 select unnest(array['google_books','hardcover','isbndb']) provider
)
select b.snapshot_at, p.provider, b.today utc_day,
 coalesce(sum(c.upstream_requests) filter(where c.usage_date=b.today),0) today_requests,
 coalesce(sum(c.upstream_requests) filter(where c.usage_date>=b.today-6),0) last_7_days_requests,
 coalesce(sum(c.upstream_requests),0) last_30_days_requests,
 case when p.provider='hardcover' then (select last_request_at from public.novori_api_usage_tracking where provider='hardcover')
      when p.provider='isbndb' then (select max(last_request_at) from public.novori_isbndb_usage_daily) end last_request_at
from bounds b cross join providers p
left join counts c on c.provider=p.provider and c.usage_date between b.today-29 and b.today
group by b.snapshot_at,b.today,p.provider order by p.provider;
