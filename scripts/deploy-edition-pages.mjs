import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const token=process.env.SUPABASE_ACCESS_TOKEN;
const project=process.env.NOVORI_SUPABASE_PROJECT_REF ?? 'oanpmuiuuwljknwvyzev';
if(!token){console.error('Copy your saved CLI token and export SUPABASE_ACCESS_TOKEN first.');process.exit(1);}
const query=readFileSync(fileURLToPath(new URL('../supabase/migrations/20261009160000_edition_pages_recap.sql',import.meta.url)),'utf8');
const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:false})});
if(!response.ok){const body=await response.text();console.error(`Page-count database update failed (${response.status}): ${body}`);if(response.status===403)console.error('This CLI token needs database_write permission. No database password is used.');process.exit(1);}
console.log('Page-count database update applied.');
const deployed=spawnSync('bash',['scripts/deploy-catalog-repair.sh'],{stdio:'inherit'});
process.exit(deployed.status ?? 1);
