const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
function load(file, requireFn = () => { throw Error('Unexpected dependency'); }) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/'+file),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    { exports, require:requireFn, Date, Math, Number, Error, console, Intl:{DateTimeFormat:()=>({resolvedOptions:()=>({timeZone:'America/Chicago'})})} });
  return exports;
}
const insights = load('reading-insights.ts');
const card = load('reading-recap-card.ts', name => name === './reading-insights' ? insights : (() => { throw Error(name); })());
const snapshot = { schemaVersion:1,kind:'month',periodStart:'2024-03-01',periodEndExclusive:'2024-04-01',throughDate:'2024-03-31',finishedBooks:2,daysRead:4,bestStreak:3,
  books:[{googleBookId:'stored-book',isbn:'9781234567897',title:'Story',coverUrl:'https://example.com/original.jpg'}] };
function harness({signedIn=true,error=null,data=snapshot}={}) {
  const calls=[], mutations=[];
  const supabase={auth:{getUser:async()=>({data:{user:signedIn?{id:'reader-1'}:null}})},rpc:async(name,args)=>{calls.push({name,args});return{data,error};}};
  const api=load('reading-recap-sharing.ts',name=>name==='./supabase'?{supabase}:name==='./reading-recap-card'?card:name==='./feed'?{markPostMutation:()=>mutations.push(true),getPostDetail:async()=>data}:(()=>{throw Error('No book provider imports: '+name);})());
  return{api,calls,mutations};
}
test('share periods use Monday weeks and real month/year boundaries',()=>{
  expect(card.getRecapSharePeriod('week',new Date(2024,2,10,12))).toBe('2024-03-04');
  expect(card.getRecapSharePeriod('month',new Date(2024,1,29,12))).toBe('2024-02-01');
  expect(card.getRecapSharePeriod('year',new Date(2024,1,29,12))).toBe('2024-01-01');
});
test.each([['week','2024-03-10'],['month','2024-02-30'],['year','2024-03-01'],['other','2024-01-01']])('invalid share period %s/%s makes no request',async(kind,start)=>{
  const h=harness();await expect(h.api.getReadingRecapSnapshot(kind,start)).rejects.toThrow('valid reading period');expect(h.calls).toEqual([]);
});
test('snapshot preparation uses only one own-account database read',async()=>{
  const h=harness();expect(await h.api.getReadingRecapSnapshot('month','2024-03-01')).toEqual(snapshot);
  expect(h.calls).toEqual([{name:'get_reading_recap_snapshot',args:{recap_kind:'month',period_start:'2024-03-01',reader_timezone:'America/Chicago'}}]);expect(h.mutations).toEqual([]);
});
test('publication preserves the reviewed snapshot, caption, destination and retry key',async()=>{
  const h=harness({data:'post-1'});const key='stable-share-request-key';
  await h.api.publishReadingRecap(snapshot,' Great month! ','club-1',key);
  expect(h.calls).toEqual([{name:'publish_reading_recap_post',args:{recap_kind:'month',period_start:'2024-03-01',reader_timezone:'America/Chicago',expected_snapshot:snapshot,target_club_id:'club-1',post_caption:'Great month!',share_request_key:key}}]);expect(h.mutations).toEqual([true]);
});
test('feed publishing allows a captionless recap without a destination fallback',async()=>{
  const h=harness({data:'post-1'});await h.api.publishReadingRecap(snapshot,'',null,'stable-share-request-key');expect(h.calls[0].args.target_club_id).toBeNull();expect(h.calls[0].args.post_caption).toBe('');
});
test('failed or unconfirmed publication never marks the feed as changed or falls back to a regular post',async()=>{
  const h=harness({error:{message:'Join this club before sharing there.'}});await expect(h.api.publishReadingRecap(snapshot,'','club-1','stable-share-request-key')).rejects.toThrow('Join this club');expect(h.calls).toHaveLength(1);expect(h.mutations).toEqual([]);
  const empty=harness({data:null});await expect(empty.api.publishReadingRecap(snapshot,'',null,'stable-share-request-key')).rejects.toThrow('confirm');expect(empty.mutations).toEqual([]);
});
test('edits update only caption and destination; the frozen snapshot is not sent or rebuilt',async()=>{
  const h=harness({data:'post-1'});await h.api.updateReadingRecap('post-1',' Edited ','club-1');
  expect(h.calls).toEqual([{name:'update_reading_recap_post',args:{target_post_id:'post-1',target_club_id:'club-1',post_caption:'Edited'}}]);expect(h.mutations).toEqual([true]);
});
test('only the author can load an editable recap',async()=>{
  const h=harness({data:{author_id:'other',reading_recap:snapshot}});await expect(h.api.getEditableReadingRecap('post-1')).rejects.toThrow('unavailable');
  const own=harness({data:{id:'post-1',author_id:'reader-1',reading_recap:snapshot}});expect((await own.api.getEditableReadingRecap('post-1')).id).toBe('post-1');
});
test('signed-out preparation and publication send no request',async()=>{
  const h=harness({signedIn:false});await expect(h.api.getReadingRecapSnapshot('month','2024-03-01')).rejects.toThrow('Sign in');await expect(h.api.publishReadingRecap(snapshot,'',null,'stable-share-request-key')).rejects.toThrow('Sign in');expect(h.calls).toEqual([]);
});
test('invalid captions and malformed snapshots cannot publish',async()=>{
  const h=harness();await expect(h.api.publishReadingRecap(snapshot,'x'.repeat(1201),null,'stable-share-request-key')).rejects.toThrow('1,200');
  await expect(h.api.publishReadingRecap({...snapshot,bestStreak:99},'',null,'stable-share-request-key')).rejects.toThrow('Reload');expect(h.calls).toEqual([]);
});
test.each([{schemaVersion:2},{periodEndExclusive:'2024-05-01'},{finishedBooks:-1},{daysRead:367},{throughDate:'2024-04-01'},{books:Array(7).fill(snapshot.books[0])}])('malformed attachments fail closed: %o',change=>{
  expect(card.parseReadingRecapSnapshot({...snapshot,...change})).toBeNull();
});
test('snapshots have readable period labels and partial-period notes',()=>{
  expect(card.getRecapCardTitle(snapshot)).toContain('March');expect(card.getRecapSnapshotNote(snapshot)).toBeNull();
  expect(card.getRecapSnapshotNote({...snapshot,throughDate:'2024-03-10'})).toContain('through');
});
test('recap posts open their own editor while ordinary posts keep their editor',()=>{
  const route=load('post-edit-route.ts');expect(route.getPostEditRoute({id:'post-1',post_type:'post',reading_recap:snapshot})).toEqual({pathname:'/share-reading-recap',params:{editPostId:'post-1'}});
  expect(route.getPostEditRoute({id:'post-2',post_type:'question'}).pathname).toBe('/ask-readers');
});
test('existing post media query hydrates recap metadata in the same batch',async()=>{
  const calls=[];
  const supabase={from:table=>({select:columns=>({in:async(field,ids)=>{calls.push({table,columns,field,ids});return{data:[{id:'post-1',reading_recap:snapshot,post_image_url:'photo.jpg',book_stack_id:'stack-1'}],error:null};}})})};
  const api=load('feed.ts',name=>name==='./supabase'?{supabase}:card);
  const result=await api.attachPostImageUrls([{id:'post-1',body:'Hello'}]);
  expect(calls).toHaveLength(1);expect(result[0]).toMatchObject({reading_recap:snapshot,post_image_url:'photo.jpg',book_stack_id:'stack-1'});
});
test('an older database preserves existing post media without inventing a recap',async()=>{
  let reads=0;
  const supabase={from:()=>({select:()=>({in:async()=>++reads===1?{error:{code:'42703'}}:{data:[{id:'post-1',post_image_url:'photo.jpg'}],error:null}})})};
  const api=load('feed.ts',name=>name==='./supabase'?{supabase}:card);
  const result=await api.attachPostImageUrls([{id:'post-1'}]);expect(result[0].post_image_url).toBe('photo.jpg');expect(result[0].reading_recap).toBeNull();
});
