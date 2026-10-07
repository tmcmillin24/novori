const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const {execFileSync}=require('node:child_process');
function source(file){return ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;}
function load(file,requireFn=()=>{throw Error('Unexpected provider dependency')}){const exports={};vm.runInNewContext(source(file),{exports,require:requireFn,Date,Error,Intl});return exports;}
const pure=load('club-read.ts');
const read={id:'read-1',club_id:'club-1',book:{googleBookId:'cached-book',isbn:'9781234567897',title:'Book',authors:['Author'],coverUrl:'stored-cover'},status:'current',started_on:'2026-10-01',ended_on:null,note:'Read together.',updated_at:'2026-10-03T10:00:00Z'};
function harness(data=read,error=null){const calls=[],supabase={rpc:async(name,args)=>{calls.push({name,args});return{data,error};}};return{calls,api:load('club-reads.ts',name=>name==='./supabase'?{supabase}:name==='./club-read'?pure:(()=>{throw Error('Unexpected cover or provider dependency '+name)})())};}
test('club read loading preserves stored cover metadata and uses one database call',async()=>{
 const h=harness();expect(await h.api.getClubRead(read.id)).toEqual(read);expect(h.calls).toEqual([{name:'get_club_read',args:{target_read_id:read.id}}]);
 const page=harness({current:read,upcoming:[{...read,id:'next',status:'upcoming'}],past:[],upcoming_more:true,past_more:false});expect((await page.api.getClubReads('club-1')).current.book).toEqual(read.book);expect(page.calls).toHaveLength(1);
 await page.api.getClubReads('club-1','upcoming',20);expect(page.calls[1]).toEqual({name:'get_club_reads',args:{target_club_id:'club-1',read_scope:'upcoming',page_offset:20,result_limit:20}});
});
test('saving forwards the stored identity, stable creation key, and edit revision',async()=>{
 const h=harness('read-1');await h.api.saveClubRead('club-1',{...read,note:'  Read together.  '},undefined,'stable-read-key');expect(h.calls[0].args).toMatchObject({request_key:'stable-read-key',target_read_id:null,read_input:{note:'Read together.',book:read.book}});
 await h.api.saveClubRead('club-1',{...read,status:'past'},read);expect(h.calls[1].args.expected_updated_at).toBe(read.updated_at);expect(h.calls[1].args.read_input.book).toEqual(read.book);
});
test.each([{book:null},{status:'invalid'},{started_on:'2026-02-30'},{ended_on:'2026-09-01'},{note:'x'.repeat(1001)},{started_on:'2026-1-1'}])('invalid club reads do not reach the database: %o',async change=>{
 const h=harness('read-1');await expect(h.api.saveClubRead('club-1',{...read,...change})).rejects.toThrow();expect(h.calls).toEqual([]);
});
test('removal passes the revision and never modifies a book library',async()=>{
 const h=harness();await h.api.removeClubRead(read);expect(h.calls).toEqual([{name:'remove_club_read',args:{target_read_id:read.id,expected_updated_at:read.updated_at}}]);
});
test('server failures are surfaced and malformed confirmed reads are rejected',async()=>{
 const h=harness(null,new Error('Permission changed'));await expect(h.api.getClubReads('club-1')).rejects.toThrow('Permission changed');await expect(h.api.saveClubRead('club-1',read)).rejects.toThrow('Permission changed');await expect(h.api.removeClubRead(read)).rejects.toThrow('Permission changed');
 await expect(harness(null).api.getClubRead(read.id)).rejects.toThrow('unavailable');await expect(harness(null).api.saveClubRead('club-1',read)).rejects.toThrow('confirm');
});
test('optional calendar dates remain the same day across reader time zones',()=>{
 const script=`const exports={};${source('club-read.ts')}\nprocess.stdout.write(exports.formatClubReadDates({started_on:'2026-11-01',ended_on:'2026-11-02'}));`;
 const la=execFileSync(process.execPath,['-e',script],{env:{...process.env,TZ:'America/Los_Angeles'}}).toString(),tokyo=execFileSync(process.execPath,['-e',script],{env:{...process.env,TZ:'Asia/Tokyo'}}).toString();expect(la).toBe(tokyo);expect(la).toContain('Nov 1');expect(la).toContain('Nov 2');expect(pure.formatClubReadDates({started_on:null,ended_on:null})).toBe('');
});
