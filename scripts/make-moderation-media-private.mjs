// Use the Storage API so visibility changes follow its supported CDN/cache path.
// Run after backfill and the media/app route tests, immediately before activation SQL.
import { createClient } from '@supabase/supabase-js';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Set local EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
for(const bucket of ['avatars','post-media','club-covers','moderation-quarantine']) {
 const result=await client.storage.updateBucket(bucket,{public:false});
 if(result.error)throw Error(`Could not make ${bucket} private. Stop before activation and inspect Storage settings.`);
}
console.log('Media buckets are private. Run enable-moderation.sql and verify uncached raw-origin requests fail.');
