const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
function harness({ signedIn = true, error = null, data = [] } = {}) {
  const calls = [];
  const supabase = { auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'reader-1' } : null } }) },
    rpc: async (name,args) => { calls.push({ name,args }); return { data,error }; } };
  const exports = {};
  const source = fs.readFileSync(require('path').join(__dirname,'../src/lib/reading-goal-books.ts'),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    { exports,Intl:{DateTimeFormat:()=>({resolvedOptions:()=>({timeZone:'America/Chicago'})})},
      require:name=>{if(name==='./supabase') return {supabase};throw Error('Cover metadata must not call a provider: '+name);} });
  return {api:exports,calls};
}
test('visible cover metadata uses one own-account RPC, phone timezone, and stored identities',async()=>{
  const book={completionId:'journey:1',userBookId:'book-1',googleBookId:'google-1',isbn:'9781234567897',title:'Story',coverUrl:'https://example.com/original.jpg'};
  const h=harness({data:[book]});
  expect(await h.api.getReadingGoalBooks('monthly','2026-10-01',6)).toEqual([book]);
  expect(h.calls).toEqual([{name:'get_reading_goal_books',args:{goal_kind:'monthly',period_start:'2026-10-01',reader_timezone:'America/Chicago',book_offset:6,book_limit:6}}]);
});
test.each([[-1,6],[0,0],[0,13],[1.5,6],[0,1.5]])('invalid page %s/%s sends no request',async(offset,limit)=>{
  const h=harness(); await expect(h.api.getReadingGoalBooks('annual','2026-01-01',offset,limit)).rejects.toThrow('page'); expect(h.calls).toEqual([]);
});
test('signed-out readers cannot request cover metadata',async()=>{
  const h=harness({signedIn:false});await expect(h.api.getReadingGoalBooks('annual','2026-01-01',0)).rejects.toThrow('Sign in');expect(h.calls).toEqual([]);
});
test('invalid periods send no cover request',async()=>{
  const h=harness();await expect(h.api.getReadingGoalBooks('annual','2026-02-01',0)).rejects.toThrow('calendar');expect(h.calls).toEqual([]);
});
test('cover read errors propagate so the UI can retry without changing progress',async()=>{
  const h=harness({error:{message:'unavailable'}});await expect(h.api.getReadingGoalBooks('annual','2026-01-01',0)).rejects.toMatchObject({message:'unavailable'});
});
