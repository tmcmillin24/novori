const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const path = require('path');
function load(file,requireFn=()=>{throw Error('Unexpected import');}) {
  const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/'+file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:requireFn,console,Error});return exports;
}
const home=load('club-home.ts');
test('owner can edit and manage, and has no leave action',()=>{
  expect(home.getClubHomeActions('owner',true,false)).toEqual(['edit','rules','members','manage','guide','notifications','notification_settings']);
});
test('admin can manage but cannot edit club identity or rules',()=>{
  expect(home.getClubHomeActions('admin',true,true)).toEqual(['rules','members','manage','guide','notifications','notification_settings','leave']);
});
test('member has only readable information and leave options',()=>{
  expect(home.getClubHomeActions('member',true,true)).toEqual(['rules','members','guide','notifications','notification_settings','leave']);
});
test('private nonmembers cannot see a member action; empty rules create no option',()=>{
  expect(home.getClubHomeActions(null,false,false)).toEqual([]);
  expect(home.getClubHomeActions(null,false,true)).toEqual(['rules']);
  expect(home.getClubHomeActions(null,true,false)).toEqual(['members']);
});
test('rules are optional, trimmed, preserve line breaks, and enforce their limit',()=>{
  expect(home.validateClubRules(undefined)).toBe('');expect(home.validateClubRules('  Be kind.\nLabel spoilers.  ')).toBe('Be kind.\nLabel spoilers.');
  expect(home.validateClubRules('x'.repeat(2000))).toHaveLength(2000);expect(()=>home.validateClubRules('x'.repeat(2001))).toThrow('2,000');
});
function harness(signedIn=true){
  const writes=[];let write;
  const query={insert:payload=>{write={kind:'insert',payload,filters:[]};writes.push(write);return query;},update:payload=>{write={kind:'update',payload,filters:[]};writes.push(write);return query;},
    eq:(key,value)=>{write.filters.push([key,value]);return query;},select:()=>query,single:async()=>({data:{id:'club',...write.payload}})};
  const supabase={auth:{getUser:async()=>({data:{user:signedIn?{id:'owner'}:null}})},from:table=>{if(table!=='clubs')throw Error('Unexpected data access');return query;}};
  const api=load('clubs.ts',name=>name==='./supabase'?{supabase}:name==='./club-home'?home:name==='./canonical-book-covers'?{resolveCanonicalBookCover:()=>{throw Error('No cover calls expected');}}:(()=>{throw Error(name);})());
  return {api,writes};
}
test('create includes optional rules in the same existing club write',async()=>{
  const h=harness();await h.api.createClub({name:'Readers',description:'A club',privacy:'public',rules:' Be kind. '});
  expect(h.writes).toHaveLength(1);expect(h.writes[0].payload).toMatchObject({owner_id:'owner',rules:'Be kind.'});
});
test('updates preserve owner filtering and send edited rules in the same write',async()=>{
  const h=harness();await h.api.updateClub('club',{name:'Readers',description:'A club',privacy:'private',rules:' Label spoilers. '});
  expect(h.writes).toHaveLength(1);expect(h.writes[0].payload.rules).toBe('Label spoilers.');expect(h.writes[0].filters).toEqual([['id','club'],['owner_id','owner']]);
});
test('other update callers which omit rules do not clear existing rules',async()=>{
  const h=harness();await h.api.updateClub('club',{name:'Readers',description:'A club',privacy:'public'});expect(h.writes[0].payload).not.toHaveProperty('rules');
});
test('clearing rules is explicit and valid; oversized rules do not write',async()=>{
  const h=harness();await h.api.updateClub('club',{name:'Readers',description:'A club',privacy:'public',rules:''});expect(h.writes[0].payload.rules).toBe('');
  await expect(h.api.createClub({name:'Readers',description:'A club',privacy:'public',rules:'x'.repeat(2001)})).rejects.toThrow('2,000');expect(h.writes).toHaveLength(1);
});
test('signed-out writes remain blocked',async()=>{
  const h=harness(false);await expect(h.api.updateClub('club',{name:'Readers',description:'',privacy:'public',rules:'Rules'})).rejects.toThrow('signed in');expect(h.writes).toEqual([]);
});
