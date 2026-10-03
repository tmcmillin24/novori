const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const {execFileSync}=require('node:child_process');
function source(file){return ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;}
function load(file,requireFn=()=>{throw Error('Unexpected dependency')}){const exports={};vm.runInNewContext(source(file),{exports,require:requireFn,Date,Error,URL,Intl,console});return exports;}
const pure=load('club-event.ts');
const event={id:'event-1',post_id:'event-post',club_id:'club-1',title:'Friday Readers',description:'A good conversation.',starts_at:'2099-06-01T23:00:00Z',ends_at:'2099-06-02T01:00:00Z',timezone:'America/Chicago',kind:'in_person',location:'Cafe',meeting_url:null,book:{googleBookId:'cached-book',isbn:'9781234567897',title:'Book',authors:['Author'],coverUrl:'stored-cover'},cancelled_at:null,updated_at:'2026-10-03T10:00:00Z'};
function harness(data=event,error=null){const calls=[],mutations=[];const supabase={rpc:async(name,args)=>{calls.push({name,args});return{data,error};}};const api=load('club-events.ts',name=>name==='./supabase'?{supabase}:name==='./club-event'?pure:name==='./feed'?{markPostMutation:()=>mutations.push(true)}:(()=>{throw Error('No cover or provider calls '+name)})());return{api,calls,mutations};}
test('event reads and pages use only the database and retain cached book identities',async()=>{
  const h=harness();expect(await h.api.getClubEvent('event-1')).toEqual(event);expect(h.calls).toEqual([{name:'get_club_event',args:{target_event_id:'event-1'}}]);expect(h.mutations).toEqual([]);
  const page=harness([event]);expect(await page.api.getClubEvents('club-1','past',20)).toEqual([event]);expect(page.calls[0].args).toEqual({target_club_id:'club-1',event_scope:'past',page_offset:20,result_limit:20});
});
test('saving is one transactional RPC, with the same request key and no media rebuild',async()=>{
  const h=harness('event-1');expect(await h.api.saveClubEvent('club-1',{...event,title:'  Friday Readers  '},undefined,'stable-event-request-key')).toBe('event-1');
  expect(h.calls[0]).toMatchObject({name:'save_club_event',args:{target_event_id:null,request_key:'stable-event-request-key',event_input:{title:'Friday Readers',book:event.book}}});expect(h.mutations).toEqual([true]);
  await h.api.saveClubEvent('club-1',event,event);expect(h.calls[1].args.expected_updated_at).toBe(event.updated_at);
});
test.each([{title:'x'},{ends_at:event.starts_at},{starts_at:'bad date'},{location:''},{kind:'virtual',meeting_url:'javascript:alert(1)'},{kind:'virtual',meeting_url:'not a URL'},{description:'x'.repeat(2001)}])('invalid event data makes no mutation: %o',async change=>{
  const h=harness('event-1');await expect(h.api.saveClubEvent('club-1',{...event,...change})).rejects.toThrow();expect(h.calls).toEqual([]);
});
test('virtual event normalization clears unused location fields',()=>{expect(pure.validateClubEvent({...event,kind:'virtual',meeting_url:' https://meet.example.com/readers '})).toMatchObject({location:null,meeting_url:'https://meet.example.com/readers'});});
test('RSVP updates return confirmed counts and cancellation invalidates post views',async()=>{
  const h=harness({...event,viewer_rsvp:'going',going_count:1});expect((await h.api.setClubEventRsvp('event-1','going')).going_count).toBe(1);
  expect(h.calls[0]).toEqual({name:'set_club_event_rsvp',args:{target_event_id:'event-1',rsvp_status:'going'}});await h.api.setClubEventRsvp('event-1',null);expect(h.calls[1].args.rsvp_status).toBeNull();
  await h.api.cancelClubEvent('event-1');expect(h.mutations).toEqual([true]);
});
test('failures never mark posts changed or silently confirm RSVP',async()=>{
  const h=harness(null,new Error('Permission changed'));await expect(h.api.saveClubEvent('club-1',event)).rejects.toThrow('Permission changed');await expect(h.api.cancelClubEvent('event-1')).rejects.toThrow('Permission changed');await expect(h.api.setClubEventRsvp('event-1','going')).rejects.toThrow('Permission changed');expect(h.mutations).toEqual([]);
});
test('ended and cancelled events are excluded at the exact boundary',()=>{
  expect(pure.isUpcomingClubEvent(event,Date.parse(event.ends_at)-1)).toBe(true);expect(pure.isUpcomingClubEvent(event,Date.parse(event.ends_at))).toBe(false);expect(pure.isUpcomingClubEvent({...event,cancelled_at:'2026-10-03'})).toBe(false);
});
test('local wall times reject impossible dates, invalid minutes and DST gaps',()=>{
  const script=`const exports={};${source('club-event.ts')}\nconst results=[];for(const args of [['2027-03-14','2','30',false],['2027-02-30','6','00',true],['2027-11-07','1','30',false]]){try{results.push(exports.localClubEventInstant(...args));}catch(error){results.push(error.message);}}process.stdout.write(JSON.stringify(results));`;
  const result=JSON.parse(execFileSync(process.execPath,['-e',script],{env:{...process.env,TZ:'America/Chicago'}}).toString());expect(result[0]).toContain('does not exist');expect(result[1]).toContain('does not exist');expect(result[2]).toBe('2027-11-07T06:30:00.000Z');
  expect(()=>pure.localClubEventInstant('2027-10-01','6','60',true)).toThrow('minutes');
});
test('reader-facing formatting uses the viewer time zone, including overnight meetings',()=>{
  const script=`const exports={};${source('club-event.ts')}\nprocess.stdout.write(exports.formatClubEventTime(${JSON.stringify(event)}));`;
  const chicago=execFileSync(process.execPath,['-e',script],{env:{...process.env,TZ:'America/Chicago'}}).toString(),tokyo=execFileSync(process.execPath,['-e',script],{env:{...process.env,TZ:'Asia/Tokyo'}}).toString();expect(chicago).toContain('6:00');expect(tokyo).toContain('8:00');expect(chicago).not.toBe(tokyo);
});
test('event posts route to the event editor without changing ordinary post editing',()=>{
  const routes=load('post-edit-route.ts',()=>({}));expect(routes.getPostEditRoute({club_event:event})).toEqual({pathname:'/create-club-event',params:{clubId:'club-1',eventId:'event-1'}});expect(routes.getPostEditRoute({id:'plain',post_type:'post'}).pathname).toBe('/create-post');
});
