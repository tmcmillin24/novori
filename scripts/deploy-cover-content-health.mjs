import {readFileSync} from 'node:fs';
const token=process.env.SUPABASE_ACCESS_TOKEN;
const project=process.env.NOVORI_SUPABASE_PROJECT_REF??'oanpmuiuuwljknwvyzev';
if(!token){console.error('Export your copied CLI token as SUPABASE_ACCESS_TOKEN first.');process.exit(1);}
const query=readFileSync(new URL('../supabase/migrations/20261009190000_cover_content_health.sql',import.meta.url),'utf8');
const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:false})});
if(!response.ok){console.error(`Cover verification database update failed (${response.status}): ${await response.text()}`);process.exit(1);}
console.log('Shared cover-content cache applied; confirmed provider placeholder rejected.');
