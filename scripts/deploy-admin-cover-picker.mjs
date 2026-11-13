import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token){console.error('Copy and export your Supabase CLI token first.');process.exit(1);}
const project='oanpmuiuuwljknwvyzev';
const endpoint=`https://api.supabase.com/v1/projects/${project}`;
async function query(sql,readOnly){
 const response=await fetch(`${endpoint}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Database operation failed (${response.status}): ${(await response.text()).slice(0,600)}`);return response.json();
}
const access=await fetch(`${endpoint}/functions/novori-admin`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
if(!access.ok)throw new Error(`Admin function access failed (${access.status}). Token needs Edge Functions Read-write.`);
const [state]=await query(`select to_regclass('public.book_cover_candidates') is not null and to_regclass('public.book_cover_selections') is not null and to_regclass('public.novori_admin_members') is not null as ready`,true);
if(!state?.ready)throw new Error('Existing catalog/admin foundation is missing. Stopped without applying changes.');
await query(readFileSync(new URL('../supabase/migrations/20261113010000_admin_cover_picker.sql',import.meta.url),'utf8'),false);
const [verified]=await query("select to_regprocedure('public.novori_admin_set_book_cover(uuid,uuid,text,text,text,uuid,uuid)') is not null as ready",true);
if(!verified?.ready)throw new Error('Cover picker verification failed.');
const deployed=spawnSync('npx',['supabase','functions','deploy','novori-admin','--project-ref',project,'--no-verify-jwt'],{stdio:'inherit',cwd:fileURLToPath(new URL('../',import.meta.url))});
if(deployed.error||deployed.status!==0)throw new Error('Admin function deployment failed. Rerun this helper; the migration is repeatable.');
console.log('Cover picker backend deployed. No cover selections were changed. Deploy the admin website to use Book artwork → Choose replacement cover. No app build required.');
