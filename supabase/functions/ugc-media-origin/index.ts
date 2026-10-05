declare const Deno: { env: {get(name:string):string|undefined}; serve(handler:(request:Request)=>Promise<Response>):void };
// @ts-ignore -- Supabase Edge npm resolution
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } });
Deno.serve(async request => {
  const secret = Deno.env.get('NOVORI_MEDIA_ORIGIN_SECRET');
  if (!['GET','HEAD'].includes(request.method) || !secret || request.headers.get('X-Novori-Media-Origin') !== secret) return new Response(null, { status: 403 });
  const url = new URL(request.url), bucket = url.searchParams.get('bucket'), path = url.searchParams.get('path');
  if (!bucket || !path || !['avatars','post-media','club-covers'].includes(bucket) || path.includes('..')) return new Response(null, { status: 404 });
  const { data, error } = await client.from('novori_moderated_media').select('blocked,user_id,sha256').eq('bucket', bucket).eq('path', path).maybeSingle();
  if (error) return new Response(null, { status: 503 });
  if (!data || data.blocked) return new Response(null, { status: 404 });
  const blocked=await client.from('novori_blocked_image_hashes').select('sha256').eq('user_id',data.user_id).eq('sha256',data.sha256).maybeSingle();
  if(blocked.error)return new Response(null,{status:503});
  if(blocked.data)return new Response(null,{status:404});
  const [active,restricted]=await Promise.all([client.rpc('novori_account_active',{reader_id:data.user_id}),client.rpc('novori_reader_restricted',{p_user:data.user_id})]);
  if(active.error||restricted.error)return new Response(null,{status:503});
  if(!active.data||restricted.data)return new Response(null,{status:404});
  if(request.method==='HEAD') return new Response(null,{headers:{'Cache-Control':'no-store'}});
  const download = await client.storage.from(bucket).download(path);
  if (download.error || !download.data) return new Response(null, { status: 404 });
  return new Response(download.data, { headers: { 'Content-Type': download.data.type, 'Cache-Control': 'public,max-age=300', 'X-Content-Type-Options': 'nosniff' } });
});
