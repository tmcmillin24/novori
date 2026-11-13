const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token)throw new Error('Copy and export your Supabase CLI token first.');
const query=`select jsonb_build_object(
 'database_activity',(select jsonb_agg(to_jsonb(x)) from (
  select application_name,state,wait_event_type,wait_event,
   round(extract(epoch from now()-query_start)) as query_seconds,
   cardinality(pg_blocking_pids(pid)) as blockers
  from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and state<>'idle'
  order by query_start limit 12)x),
 'profile_indexes',(select jsonb_agg(indexdef) from pg_indexes where schemaname='public' and tablename='profiles'),
 'profile_policies',(select jsonb_agg(jsonb_build_object('name',policyname,'command',cmd,'using',qual)) from pg_policies where schemaname='public' and tablename='profiles'),
 'recent_jobs',(select jsonb_agg(to_jsonb(x)) from (
  select j.jobname,d.status,count(*) as runs,max(d.end_time-d.start_time)::text as longest
  from cron.job_run_details d join cron.job j using(jobid)
  where d.start_time>now()-interval '15 minutes' group by j.jobname,d.status order by j.jobname)x)
) as diagnostic;`;
const r=await fetch('https://api.supabase.com/v1/projects/oanpmuiuuwljknwvyzev/database/query',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:false}),signal:AbortSignal.timeout(30000)});
const text=await r.text();if(!r.ok)throw new Error(`Read-only diagnostic failed (${r.status}). CLI token needs Database Read/write to inspect activity.`);
console.log(JSON.stringify(text.trim()?JSON.parse(text):null,null,2));
