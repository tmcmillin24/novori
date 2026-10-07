import { MEDIA_BUCKETS } from './ugc-contract.mjs';
/** The deletion worker calls this after acquiring its existing claim, before Auth
 * deletion. Service-created objects may lack Storage's old owner field. */
export async function cleanupReaderModerationMedia(client,userId) {
 for(let offset=0;;offset+=100) {
  const rows=await client.from('novori_moderated_media').select('bucket,path').eq('user_id',userId).range(offset,offset+99);
  if(rows.error)throw Error('Moderated image cleanup unavailable.');
  for(const bucket of MEDIA_BUCKETS) {
   const paths=(rows.data??[]).filter(row=>row.bucket===bucket).map(row=>row.path);
   if(paths.length){const result=await client.storage.from(bucket).remove(paths);if(result.error)throw Error('Moderated image cleanup will retry.');}
  }
  if((rows.data??[]).length<100)break;
 }
 for(let pass=0;pass<10;pass++) {
  const list=await client.storage.from('moderation-quarantine').list(userId,{limit:100});
  if(list.error)throw Error('Quarantine cleanup unavailable.');
  if(!list.data?.length)return;
  const result=await client.storage.from('moderation-quarantine').remove(list.data.map(file=>`${userId}/${file.name}`));
  if(result.error)throw Error('Quarantine cleanup will retry.');
 }
 throw Error('Quarantine cleanup will continue on the next retry.');
}
