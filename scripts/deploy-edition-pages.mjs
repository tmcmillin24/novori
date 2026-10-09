import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const token=process.env.SUPABASE_ACCESS_TOKEN;
const project=process.env.NOVORI_SUPABASE_PROJECT_REF ?? 'oanpmuiuuwljknwvyzev';
if(!token){console.error('Copy your saved CLI token and export SUPABASE_ACCESS_TOKEN first.');process.exit(1);}
const query=readFileSync(fileURLToPath(new URL('../supabase/migrations/20261009160000_edition_pages_recap.sql',import.meta.url)),'utf8');
const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:false})});
if(!response.ok){const body=await response.text();console.error(`Page-count database update failed (${response.status}): ${body}`);if(response.status===403)console.error('This CLI token needs Database Read-write access (database_read and database_write). No database password is used.');process.exit(1);}
console.log('Page-count database update applied.');
const deployed=spawnSync('bash',['scripts/deploy-catalog-repair.sh'],{stdio:'inherit'});
if(deployed.status!==0)process.exit(deployed.status ?? 1);
// Verify the stored editions after deployment, instead of equating an upload with repaired data.
const check=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({read_only:true,query:`select e.provider,e.provider_book_id,e.isbn_13,e.metadata#>>'{volumeInfo,title}' as title,e.page_count,e.metadata#>>'{volumeInfo,pageCount}' as detail_pages,e.metadata#>>'{novoriEdition,format}' as format,f.page_count as publisher_pages from public.book_editions e left join public.book_edition_page_facts f on f.isbn_13=e.isbn_13 where e.provider in ('isbndb','google_books') and e.metadata#>>'{volumeInfo,title}' ilike '%fate so dark and delicate%' order by e.isbn_13,e.provider;`})});
if(!check.ok){console.error(`Deployment completed, but page verification failed (${check.status}).`);process.exit(1);}
console.log('Stored edition page verification (different editions may have different counts):');
console.table(await check.json());
console.log('Reload the app to discard its prior in-memory missing-page result.');
