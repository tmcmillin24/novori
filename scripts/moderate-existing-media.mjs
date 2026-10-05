/** Run locally once before activation. Never put the service key in the app.
 * Dry-run inventories paths; --apply downloads/screens and registers existing media.
 * Work is sequential and resumable. Flagged images stay blocked on the media route.
 */
import { createClient } from '@supabase/supabase-js';
import { classify, digest, recordScreening } from '../supabase/functions/_shared/ugc-screening.mjs';
import { imageType } from '../supabase/functions/_shared/ugc-media.mjs';
import { MEDIA_BUCKETS } from '../supabase/functions/_shared/ugc-contract.mjs';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw Error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY locally.');
const apply=process.argv.includes('--apply');
if(apply&&!process.env.OPENAI_API_KEY) throw Error('Set OPENAI_API_KEY locally for --apply.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
let inventory=0,passed=0,pending=0,skipped=0;
async function walk(bucket,prefix='') {
 for(let offset=0;;offset+=100) {
  const list=await client.storage.from(bucket).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
  if(list.error) throw Error(`Could not list ${bucket}; stop before activation.`);
  for(const file of list.data) {
   const path=prefix?`${prefix}/${file.name}`:file.name;
   if(!file.id) {await walk(bucket,path);continue;}
   inventory++;
   if(!apply) continue;
   const known=await client.from('novori_moderated_media').select('path').eq('bucket',bucket).eq('path',path).maybeSingle();
   if(known.error) throw Error('Run the screening migration first.');
   if(known.data) {skipped++;continue;}
   const user=path.split('/')[0];
   if(!/^[0-9a-f-]{36}$/i.test(user)) throw Error(`Unsupported legacy owner path in ${bucket}. Review before activation.`);
   const download=await client.storage.from(bucket).download(path);
   if(download.error||!download.data||download.data.size>8388608) throw Error(`Could not read legacy image in ${bucket}; review before activation.`);
   const bytes=new Uint8Array(await download.data.arrayBuffer()),type=imageType(bytes),hash=await digest(bytes);
   const result=await classify([{type:'image_url',image_url:{url:`data:${type};base64,${Buffer.from(bytes).toString('base64')}`}}],process.env.OPENAI_API_KEY);
   let quarantine=null;
   if(result.flagged) {
    quarantine=`${user}/${hash}`;
    const q=await client.storage.from('moderation-quarantine').upload(quarantine,bytes,{contentType:type,upsert:true});
    if(q.error) throw Error('Could not quarantine a flagged legacy image.');
   }
   await recordScreening(client,user,await digest(`legacy:${bucket}:${path}:${hash}`),`legacy-media:${bucket}`,{bucket,path,image_sha256:hash},result,quarantine);
   const saved=await client.from('novori_moderated_media').insert({bucket,path,user_id:user,sha256:hash,blocked:result.flagged});
   if(saved.error) throw Error('Could not register a legacy image.');
   result.flagged?pending++:passed++;
  }
  if(list.data.length<100) break;
 }
}
for(const bucket of MEDIA_BUCKETS) await walk(bucket);
console.log(JSON.stringify({mode:apply?'apply':'inventory',inventory,passed,pending,skipped}));
console.log('Review all pending legacy images in Admin. Migration does not certify scanner coverage or store approval.');
