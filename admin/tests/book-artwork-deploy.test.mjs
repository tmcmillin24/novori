import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deployBookArtworkReports } from '../../scripts/deploy-book-artwork-reports.mjs';
const state = value => ({reports_table:value,queue_view:value,intake_rpc:value,review_rpc:value});
function harness({installed=false,partial=false,denied=false,failedDeploy=false}={}) {
 const calls=[],runs=[],logs=[];let ready=installed;
 return { calls,runs,logs,options:{token:'TEST_TOKEN_NOT_REAL',log:s=>logs.push(s),
  fetchImpl:async(url,options)=>{
   calls.push({url,options});
   if(url.endsWith('/functions/novori-admin'))return {ok:!denied,status:denied?403:200};
   const body=JSON.parse(options.body);
   if(body.read_only) return {ok:true,json:async()=>[{...state(ready),...(partial?{reports_table:true}:{})}]};
   if(body.query.includes('create table public.book_artwork_reports'))ready=true;
   return {ok:true,json:async()=>[]};
  },run:(command,args,options)=>{runs.push({command,args,options});return {status:failedDeploy?1:0};},
 }};
}
test('deployment applies only the targeted migration and deploys only novori-admin',async()=>{
 const h=harness();await deployBookArtworkReports(h.options);
 assert.equal(h.runs.length,1);
 assert.deepEqual(h.runs[0].args,['supabase','functions','deploy','novori-admin','--project-ref','oanpmuiuuwljknwvyzev','--no-verify-jwt']);
 const writes=h.calls.filter(call=>call.options.body).map(call=>JSON.parse(call.options.body)).filter(body=>!body.read_only);
 assert.equal(writes.length,2);assert.match(writes[0].query,/create table public.book_artwork_reports/);
 assert.equal(writes[1].query,"notify pgrst, 'reload schema';");
 assert.ok(h.logs.some(line=>line.includes('BACKEND DEPLOYED')));
 assert.ok(h.logs.every(line=>!line.includes('TEST_TOKEN_NOT_REAL')));
});
test('retry skips an installed foundation, and partial foundations stop deployment',async()=>{
 const h=harness({installed:true});await deployBookArtworkReports(h.options);
 assert.equal(h.calls.filter(call=>call.options.body&&JSON.parse(call.options.body).query.includes('create table')).length,0);
 const partial=harness({partial:true});await assert.rejects(deployBookArtworkReports(partial.options),/Only part/);assert.equal(partial.runs.length,0);
});
test('missing function permission stops before database writes, and failed deploy is not announced as success',async()=>{
 const denied=harness({denied:true});await assert.rejects(deployBookArtworkReports(denied.options),/No migration was applied/);assert.equal(denied.calls.length,1);assert.equal(denied.runs.length,0);
 const failed=harness({failedDeploy:true});await assert.rejects(deployBookArtworkReports(failed.options),/rerunning this helper is safe/);
 assert.ok(failed.logs.every(line=>!line.includes('BACKEND DEPLOYED')));
});
