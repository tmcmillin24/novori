import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function bundle(file) {
 const result=await build({entryPoints:[new URL(`../../${file}`,import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false});
 return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const {createModeratedFetch}=await bundle('src/lib/moderated-fetch.ts');
const {moderationMediaUrl}=await bundle('src/lib/moderation-media-url.ts');
test('native transport screens public writes while keeping catalog reads and private notes direct',async()=>{
 const calls=[],transport=async(input,init)=>{calls.push({url:String(input),init});return new Response('{}');},base='https://project.supabase.co',send=createModeratedFetch(base,transport);
 await send(`${base}/rest/v1/posts?select=*`,{method:'POST',headers:{Authorization:'Bearer reader',Prefer:'return=representation','Content-Type':'application/json'},body:JSON.stringify({body:'A post'})});
 assert.match(calls[0].url,/functions\/v1\/ugc-publish/);const body=JSON.parse(calls[0].init.body);assert.equal(body.path,'posts');assert.equal(body.query,'?select=*');assert.equal(body.prefer,'return=representation');
 await send(`${base}/rest/v1/user_books?id=eq.one`,{method:'PATCH',body:JSON.stringify({status:'reading'})});assert.match(calls[1].url,/rest\/v1\/user_books/);
 await send(`${base}/rest/v1/reading_notes`,{method:'POST',body:JSON.stringify({body:'private'})});assert.match(calls[2].url,/rest\/v1\/reading_notes/);
 await send(`${base}/functions/v1/google-books-search`,{method:'POST',body:'{}'});assert.match(calls[3].url,/google-books-search/);
 await send(`${base}/rest/v1/posts?select=*`);assert.match(calls[4].url,/rest\/v1\/posts/);
});
test('native upload routes bytes to screening; signup retains PKCE and credential payload',async()=>{
 const calls=[],send=createModeratedFetch('https://project.supabase.co',async(input,init)=>{calls.push({url:String(input),init});return new Response('{}');});
 const bytes=new Uint8Array([255,216,255]);await send('https://project.supabase.co/storage/v1/object/avatars/reader/avatar.jpg',{method:'POST',headers:{Authorization:'Bearer reader','Content-Type':'image/jpeg','x-novori-moderation-ticket':'FORGED'},body:bytes});assert.match(calls[0].url,/ugc-media\?bucket=avatars/);assert.equal(calls[0].init.body,bytes);assert.equal(calls[0].init.headers.has('x-novori-moderation-ticket'),false);
 const body=JSON.stringify({email:'reader@example.test',password:'test',code_challenge:'pkce'});await send('https://project.supabase.co/auth/v1/signup?redirect_to=novori%3A%2F%2Fconfirm',{method:'POST',body});assert.match(calls[1].url,/ugc-signup\?redirect_to=/);assert.equal(calls[1].init.body,body);
});
test('render-time media mapping fixes old caches without changing catalog/local images',()=>{
 const oldMedia=process.env.EXPO_PUBLIC_MODERATION_MEDIA_ORIGIN,oldUrl=process.env.EXPO_PUBLIC_SUPABASE_URL;
 process.env.EXPO_PUBLIC_MODERATION_MEDIA_ORIGIN='https://media.novori.link';process.env.EXPO_PUBLIC_SUPABASE_URL='https://project.supabase.co';
 try {assert.equal(moderationMediaUrl('https://project.supabase.co/storage/v1/object/public/avatars/reader/a.jpg?v=1'),'https://media.novori.link/avatars/reader/a.jpg?v=1');assert.equal(moderationMediaUrl('https://assets.hardcover.app/cover.jpg'),'https://assets.hardcover.app/cover.jpg');assert.equal(moderationMediaUrl('file:///crop.jpg'),'file:///crop.jpg');assert.equal(moderationMediaUrl(null),undefined);}finally {if(oldMedia===undefined)delete process.env.EXPO_PUBLIC_MODERATION_MEDIA_ORIGIN;else process.env.EXPO_PUBLIC_MODERATION_MEDIA_ORIGIN=oldMedia;if(oldUrl===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_URL;else process.env.EXPO_PUBLIC_SUPABASE_URL=oldUrl;}
});
