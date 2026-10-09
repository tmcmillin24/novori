import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const token=process.env.SUPABASE_ACCESS_TOKEN,project=process.env.NOVORI_SUPABASE_PROJECT_REF??'oanpmuiuuwljknwvyzev';
if(!token){console.error('Export your copied CLI token as SUPABASE_ACCESS_TOKEN.');process.exit(1);}
const query=readFileSync(new URL('../supabase/migrations/20261009200000_provider_observability.sql',import.meta.url),'utf8');
const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:false})});
if(!response.ok){console.error(`Cache audit migration failed (${response.status}): ${await response.text()}`);process.exit(1);}
console.log('Provider accounting migration applied.');
for(const args of [['bash',['scripts/deploy-catalog-repair.sh']],['npx',['supabase','functions','deploy','novori-admin','--no-verify-jwt','--project-ref',project]],['node',['scripts/audit-provider-cache.mjs']]]){
 const result=spawnSync(args[0],args[1],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
}
console.log('Reload the mobile dev client. Cloudflare Pages should build this branch for the updated admin UI.');
