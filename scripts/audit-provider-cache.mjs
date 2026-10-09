// Read-only, compact cache/accounting report; never print reader data or credentials.
const token=process.env.SUPABASE_ACCESS_TOKEN,project=process.env.NOVORI_SUPABASE_PROJECT_REF??'oanpmuiuuwljknwvyzev';
if(!token){console.error('Export your copied CLI token as SUPABASE_ACCESS_TOKEN.');process.exit(1);}
const query=`select jsonb_build_object(
 'recorded_today',coalesce((select jsonb_agg(x) from (select provider,upstream_requests from public.novori_api_usage_daily where usage_date=(now() at time zone 'UTC')::date union all select 'isbndb',upstream_requests from public.novori_isbndb_usage_daily where usage_date=(now() at time zone 'UTC')::date)x),'[]'::jsonb),
 'provider_reported',coalesce((select jsonb_agg(o) from public.novori_provider_usage_observations o where usage_date=(now() at time zone 'UTC')::date),'[]'::jsonb),
 'cache',coalesce((select jsonb_agg(x) from(select provider,count(*) filter(where expires_at>now()) as fresh,count(*) filter(where expires_at<=now() and stale_until>now()) as stale,count(*) filter(where stale_until<=now()) as expired,sum(hit_count) as recorded_hits from public.book_api_cache group by provider)x),'[]'::jsonb),
 'recent_attempts',coalesce((select jsonb_agg(x) from(select provider,route,started_at,status_code from public.novori_provider_request_log order by started_at desc limit 10)x),'[]'::jsonb)
) as report;`;
const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:true})});
if(!response.ok){console.error(`Audit failed (${response.status}): ${await response.text()}`);process.exit(1);}
const report=(await response.json())[0]?.report;
for(const [label,rows] of Object.entries(report??{})){console.log(label.replaceAll('_',' '));console.table(rows);}
console.log('UTC daily counts. Provider-reported totals are header observations, not estimates; old unlogged attempts are not reconstructed.');
