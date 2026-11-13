import { readFileSync } from 'node:fs';
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token) throw new Error('Copy and export your Supabase CLI token first.');
async function query(query,read_only=false){
 const r=await fetch('https://api.supabase.com/v1/projects/oanpmuiuuwljknwvyzev/database/query',{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only}),signal:AbortSignal.timeout(60000)});
 const text=await r.text();
 if(!r.ok)throw new Error(`Notification delivery setup failed (${r.status}): ${text.slice(0,900)}`);
 return text.trim()?JSON.parse(text):null;
}
const [state]=await query(`select to_regprocedure('public.get_year_in_reading_insights(integer,text)') is not null and to_regprocedure('public.sync_reading_reminder_device(text)') is not null as recap_ready,
 exists(select 1 from vault.secrets where name='novori_phone_push_worker') as worker_ready,
 exists(select 1 from cron.job where jobname='novori-phone-push' and active) as delivery_ready,
 exists(select 1 from cron.job where jobname='novori-reading-reminders' and active) as reminders_ready`);
if(!state?.recap_ready||!state?.worker_ready||!state?.delivery_ready||!state?.reminders_ready)throw new Error('Existing year recap, reminder schedule, or push worker is missing/inactive. Stopped before changes.');
for(const file of ['20261113040000_push_activity_previews.sql','20261113060000_push_inbox_wording.sql','20261113070000_anonymous_vote_push.sql','20261113080000_immediate_push.sql','20261113090000_yearly_recap_reminders.sql','20261113100000_push_reminder_eligibility.sql']){
 await query(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
}
await query(`
select cron.alter_job(jobid,schedule:='* * * * *') from cron.job where jobname='novori-reading-reminders';
select cron.schedule('novori-yearly-reading-recap','* * * * *','select public.novori_generate_yearly_recap_reminders();');`);
console.table(await query(`select jobname,active,schedule from cron.job where jobname in ('novori-phone-push','novori-reading-reminders','novori-yearly-reading-recap') order by jobname`,true));
console.log('Immediate push wake enabled; minute retry fallback retained. Daily/weekly/monthly eligibility still uses the existing generator; yearly readiness runs January 1 at 6 p.m. local for recorded reading activity. Vote phone previews are anonymous. Reload the updated development app to test yearly settings and inbox anonymity.');
