import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPublicationHandler,classify,MODERATION_CATEGORIES} from '../../supabase/functions/_shared/ugc-screening.mjs';
import {createMediaHandler,imageType} from '../../supabase/functions/_shared/ugc-media.mjs';
import {createSignupHandler} from '../../supabase/functions/_shared/ugc-signup.mjs';
import {publicationFields,screeningText} from '../../supabase/functions/_shared/ugc-contract.mjs';
import worker from '../../moderation-media/worker.mjs';
const user='30000000-0000-4000-8000-000000000001',ticket='30000000-0000-4000-8000-000000000002',version='test';
function setup(options={}) {
 const calls=[],uploads=[],forwards=[];
 const client={auth:{getUser:async()=>({data:{user:options.unauth?null:{id:user,user_metadata:{terms_version:version,privacy_version:version,adult_confirmed:!options.noTerms}}}})},rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='novori_account_active')return {data:options.active!==false};
  if(name==='novori_reader_restricted')return {data:!!options.restricted};
  if(name==='novori_claim_screening')return {data:{allowed:!options.quota,state:options.state}};
  if(name==='novori_record_screening')return {data:{id:ticket,state:args.p_flagged?'pending':'passed'}};
  if(name==='novori_issue_publication_ticket'||name==='novori_issue_registration_ticket')return {data:ticket};
  if(name==='novori_claim_registration')return {data:!options.quota};
  throw Error('Unexpected RPC');
 },from:table=>{
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:options.asset?{blocked:!!options.blocked,user_id:user}:null}),delete:()=>{calls.push({name:'cleanup',table});return q;},insert:async data=>{calls.push({name:'asset',data});return {data};},then:(resolve)=>resolve({data:null})};return q;
 },storage:{from:bucket=>({list:async()=>({data:options.exists?[{name:'photo.jpg'}]:[]}),upload:async(path,bytes,config)=>{uploads.push({bucket,path,bytes,config});return {data:{id:ticket}};},remove:async()=>({})})}};
 const transport=async(input,init)=>{const url=String(input);forwards.push({url,init});if(url.includes('api.openai.com'))return new Response(JSON.stringify({model:'test',results:[{flagged:!!options.flagged,categories:Object.fromEntries(MODERATION_CATEGORIES.map(category=>[category,category==='harassment'&&!!options.flagged]))}]}),{status:options.openaiDown?503:200});return new Response(JSON.stringify({id:'published'}),{status:201,headers:{'Content-Type':'application/json'}});};
 return {client,transport,calls,uploads,forwards};
}
const request=(body)=>new Request('https://backend.test/ugc-publish',{method:'POST',headers:{Authorization:'Bearer reader-token','Content-Type':'application/json'},body:JSON.stringify(body)});
const envelope={path:'posts',query:'?select=*',method:'POST',body:{author_id:user,body:'A book recommendation'},prefer:'return=representation'};
const handler=s=>createPublicationHandler({...s,supabaseUrl:'https://project.supabase.co',publishableKey:'public-key',openaiKey:'secret-openai',legalVersion:version});
test('publication contract covers nested discussion/event text without private notes',()=>{
 const fields=publicationFields('rpc/publish_reading_update',{post_body:'Public update',private_note_body:'SECRET'});
 assert.match(screeningText(fields),/Public update/);assert.doesNotMatch(screeningText(fields),/SECRET/);
 assert.match(screeningText(publicationFields('rpc/save_club_event',{event_input:{title:'Meeting',private_note:'SECRET',book:{title:'catalog'}}})),/Meeting/);
 assert.equal(publicationFields('rpc/arbitrary_admin_action',{}),null);
});
test('unauthenticated, restricted, inactive, unaccepted and over-quota publication fails closed',async()=>{
 for(const [options,status]of [[{unauth:true},401],[{restricted:true},403],[{active:false},403],[{noTerms:true},403],[{quota:true},429]]) {
  const s=setup(options),response=await handler(s)(request(envelope));assert.equal(response.status,status);assert.equal(s.forwards.length,0);
 }
});
test('flagged content is kept unpublished and sent to the review queue',async()=>{
 const s=setup({flagged:true}),response=await handler(s)(request(envelope));assert.equal(response.status,422);assert.equal(s.forwards.length,1);
 assert.equal(s.calls.find(c=>c.name==='novori_record_screening').args.p_flagged,true);
 assert.equal(s.calls.some(c=>c.name==='novori_issue_publication_ticket'),false);
});
test('allowed write forwards reader JWT, sanitizes Prefer, never exposes ticket, and cleans up',async()=>{
 const s=setup(),response=await handler(s)(request({...envelope,prefer:'return=representation,tx=rollback,foo=secret'}));assert.equal(response.status,201);
 const forwarded=s.forwards.find(f=>f.url.includes('/rest/v1/'));assert.equal(forwarded.init.headers.Authorization,'Bearer reader-token');
 assert.equal(forwarded.init.headers.Prefer,'return=representation');assert.equal(forwarded.init.headers['X-Novori-Moderation-Ticket'],ticket);
 assert.doesNotMatch(await response.text(),new RegExp(ticket));assert.equal(response.headers.has('X-Novori-Moderation-Ticket'),false);assert.ok(s.calls.some(c=>c.name==='cleanup'));
});
test('provider outage, malformed moderation results and arbitrary image references never publish',async()=>{
 const s=setup({openaiDown:true});assert.equal((await handler(s)(request(envelope))).status,503);assert.equal(s.forwards.length,1);
 await assert.rejects(classify('text','key',async()=>new Response(JSON.stringify({results:[{flagged:false,categories:{}}]}))),/invalid result/);
 const image=setup();assert.equal((await handler(image)(request({...envelope,body:{...envelope.body,post_image_url:'https://evil.test/image'}}))).status,400);assert.equal(image.forwards.length,0);
});
test('approved resubmission skips model call but still checks auth and uses a fresh receipt',async()=>{
 const s=setup({state:'approved'});assert.equal((await handler(s)(request(envelope))).status,201);assert.equal(s.forwards.length,1);assert.ok(s.forwards[0].url.includes('/rest/v1/'));
});
test('moderation cache key binds filters and user-visible content, excluding private notes',async()=>{
 const keys=[];for(const query of ['?id=eq.one','?id=eq.two']){const s=setup();await handler(s)(request({...envelope,query}));keys.push(s.calls.find(c=>c.name==='novori_claim_screening').args.p_key);}assert.notEqual(...keys);
 const s=setup();await handler(s)(request({path:'rpc/publish_reading_update',method:'POST',body:{post_body:'Public',private_note_body:'SECRET'}}));assert.doesNotMatch(JSON.stringify(s.forwards[0]),/SECRET/);assert.doesNotMatch(JSON.stringify(s.calls.find(c=>c.name==='novori_record_screening')),/SECRET/);
});
test('multipart Supabase empty-name upload is screened and registered immutably',async()=>{
 const s=setup(),form=new FormData();form.append('cacheControl','3600');form.append('',new Blob([new Uint8Array([255,216,255,1])],{type:'image/jpeg'}),'photo.jpg');
 const response=await createMediaHandler({...s,openaiKey:'key',legalVersion:version})(new Request(`https://backend.test?bucket=post-media&path=${user}/photo.jpg`,{method:'POST',headers:{Authorization:'Bearer reader'},body:form}));
 assert.equal(response.status,200);assert.equal(s.uploads[0].config.upsert,false);assert.equal(s.calls.find(c=>c.name==='asset').data.user_id,user);
});
test('flagged images go only to private quarantine; wrong-owner uploads and fake formats fail',async()=>{
 const s=setup({flagged:true});const run=(path,bytes)=>createMediaHandler({...s,openaiKey:'key',legalVersion:version})(new Request(`https://backend.test?bucket=avatars&path=${path}`,{method:'POST',headers:{Authorization:'Bearer reader'},body:bytes}));
 assert.equal((await run(`${user}/photo.jpg`,new Uint8Array([255,216,255,1]))).status,422);assert.equal(s.uploads.length,1);assert.equal(s.uploads[0].bucket,'moderation-quarantine');
 assert.equal((await run(`${ticket}/photo.jpg`,new Uint8Array([255,216,255]))).status,400);assert.throws(()=>imageType(new Uint8Array([1,2,3])),/JPEG/);
});
test('signup screens only names; flagged names never reach Auth and approved credentials are forwarded only to Auth',async()=>{
 const payload={email:'private@example.test',password:'PRIVATE_PASSWORD',data:{username:'reader',display_name:'Reader',terms_version:version,privacy_version:version,adult_confirmed:true}};
 const s=setup();const response=await createSignupHandler({...s,supabaseUrl:'https://project.supabase.co',publishableKey:'public',openaiKey:'key',legalVersion:version})(request(payload));assert.equal(response.status,201);
 assert.doesNotMatch(s.forwards[0].init.body,/PRIVATE_PASSWORD|private@example/);assert.match(s.forwards[1].init.body,/PRIVATE_PASSWORD/);assert.match(s.forwards[1].url,/auth\/v1\/signup/);
 const denied=setup({flagged:true});assert.equal((await createSignupHandler({...denied,supabaseUrl:'https://project.supabase.co',openaiKey:'key',legalVersion:version})(request(payload))).status,422);assert.equal(denied.forwards.length,1);
});
test('media Worker caches within the zone and revokes cached delivery when origin blocks an asset',async()=>{
 const oldFetch=globalThis.fetch,oldCaches=globalThis.caches,map=new Map(),calls=[];let blocked=false;
 globalThis.caches={default:{match:async key=>map.get(key.url)?.clone(),put:async(key,response)=>map.set(key.url,response),delete:async key=>map.delete(key.url)}};
 globalThis.fetch=async(input,init)=>{calls.push({url:String(input),init});return new Response(init.method==='HEAD'?null:'IMAGE',{status:blocked?404:200,headers:{'Cache-Control':'public,max-age=300'}});};
 try {
  const env={SUPABASE_URL:'https://project.supabase.co',NOVORI_MEDIA_ORIGIN_SECRET:'origin-secret'},req=new Request(`https://media.novori.link/avatars/${user}/photo.jpg`);
  const first=await worker.fetch(req,env);assert.equal(first.headers.get('X-Novori-Media-Cache'),'MISS');assert.equal(map.size,1);
  assert.equal((await worker.fetch(req,env)).headers.get('X-Novori-Media-Cache'),'HIT');assert.equal(calls.at(-1).init.method,'HEAD');
  assert.equal(first.headers.has('X-Novori-Media-Origin'),false);blocked=true;assert.equal((await worker.fetch(req,env)).status,404);assert.equal(map.size,0);
  assert.equal((await worker.fetch(new Request('https://media.novori.link/catalog/cover'),env)).status,404);
 }finally{globalThis.fetch=oldFetch;globalThis.caches=oldCaches;}
});

test('shared club-reading notes are screened, and catalog labels cannot bypass text filtering',()=>{
 assert.match(screeningText(publicationFields('rpc/save_club_read',{read_input:{note:'Shared note',book:{title:'Book',authors:['Writer'],coverUrl:'https://assets.hardcover.app/cover.jpg'}}})),/Shared note/);
 assert.match(screeningText(publicationFields('posts',{book_title:'Published title'})),/Published title/);
});
test('deletion cleanup removes service-owned and quarantined media without deleting another reader objects',async()=>{
 const {cleanupReaderModerationMedia}=await import('../../supabase/functions/_shared/ugc-deletion.mjs'),removed=[];let reads=0;
 const chain={eq:(_key,id)=>{assert.equal(id,user);return chain;},range:async()=>({data:[{bucket:'avatars',path:`${user}/photo.jpg`}]})};
 const client={from:()=>({select:()=>chain}),storage:{from:bucket=>({list:async prefix=>{assert.equal(prefix,user);return {data:reads++?[ ]:[{name:'hash'}]};},remove:async paths=>{removed.push({bucket,paths});return {};}})}};
 await cleanupReaderModerationMedia(client,user);assert.deepEqual(removed,[{bucket:'avatars',paths:[`${user}/photo.jpg`]},{bucket:'moderation-quarantine',paths:[`${user}/hash`]}]);
});
