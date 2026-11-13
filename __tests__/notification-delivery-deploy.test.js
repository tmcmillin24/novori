const fs=require('node:fs'),vm=require('node:vm');
async function run(ready=true){
 const calls=[];const src=fs.readFileSync('scripts/deploy-notification-delivery.mjs','utf8').replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',"'file:///project/scripts/deploy-notification-delivery.mjs'");
 await vm.runInNewContext('(async()=>{'+src+'})()',{process:{env:{SUPABASE_ACCESS_TOKEN:'fake'}},URL,AbortSignal,readFileSync:()=> 'select 1;',console:{log:()=>{},table:()=>{}},fetch:async(url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);const data=body.query.includes('as recap_ready')?[{recap_ready:ready,worker_ready:true,delivery_ready:true,reminders_ready:true}]:[];
  return{ok:true,text:async()=>JSON.stringify(data)};
 }});return calls;
}
it('checks the foundation and changes the existing reminder job without replacing its command',async()=>{
 const calls=await run();const schedule=calls.find(c=>c.query.includes('cron.alter_job'));
 expect(schedule.query).toContain("jobname='novori-reading-reminders'");expect(schedule.query).not.toContain('command:=');expect(schedule.query).toContain('novori-yearly-reading-recap');expect(schedule.query).toContain("'novori-vote-push-ready','5 seconds'");
 expect(calls.some(c=>c.query.includes('create_secret'))).toBe(false);
});
it('fails before mutations if the year-summary foundation is unavailable',async()=>{await expect(run(false)).rejects.toThrow('Stopped before changes');});
