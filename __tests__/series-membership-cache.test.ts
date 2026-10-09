import {memberMatches,seriesMemberKeys,readSeriesMembership,cacheSeriesMembership} from '../supabase/functions/_shared/series-membership-cache';
const series={id:99,name:'The Murderbot Diaries',currentPosition:8};
const books=[{title:'Platform Decay',authors:['Martha Wells'],position:8,coverBookId:'nv_platform'},{title:'All Systems Red',authors:['Martha Wells'],position:1,coverBookId:'nv_red'}];
const payload={series,books};
function db(){const rows:any[]=[{provider:'hardcover_series',request_key:'series:v5:platform',response_json:payload,fetched_at:'2026-10-01',expires_at:'2099-01-01',stale_until:'2099-02-01'}];let writes=0;return{rows,get writes(){return writes;},admin:{from(){let selected=rows.slice();const q:any={select(){return q;},eq(k:string,v:any){selected=selected.filter(row=>row[k]===v);return q;},in(k:string,v:any[]){selected=selected.filter(row=>v.includes(row[k]));return q;},gt(k:string,v:any){selected=selected.filter(row=>row[k]>v);return q;},maybeSingle(){return Promise.resolve({data:selected[0],error:null});},upsert(input:any[]){writes++;rows.push(...input);return Promise.resolve({error:null});},then(resolve:any){return Promise.resolve({data:selected,error:null}).then(resolve);}};return q;}}};}
test('siblings reuse verified membership with their own position and source lifetime',async()=>{
 const d=db();await cacheSeriesMembership(d.admin,payload,'series:v5:platform');
 const result=await readSeriesMembership(d.admin,{...books[1],title:'All Systems Red (The Murderbot Diaries)'});
 expect(result.series.currentPosition).toBe(1);expect(result.books).toEqual(books);
 const fact=d.rows.find(row=>row.request_key==='membership:v1:id:nv_red');expect(fact.expires_at).toBe('2099-01-01');expect(fact.response_json.books).toBeUndefined();
 await cacheSeriesMembership(d.admin,payload,'series:v5:platform');expect(d.writes).toBe(1);
});
test('wrong author, adaptation, expired source and missing series fail safely',async()=>{
 const d=db();await cacheSeriesMembership(d.admin,payload,'series:v5:platform');
 expect(await readSeriesMembership(d.admin,{...books[1],authors:['Other Writer']})).toBeNull();
 expect(memberMatches(books[1],{...books[1],title:'All Systems Red: The Graphic Novel'},series.name)).toBe(false);
 d.rows[0].expires_at='2000-01-01';expect(await readSeriesMembership(d.admin,books[1])).toBeNull();
 expect(seriesMemberKeys({title:'All Systems Red',authors:[]})).toEqual([]);
});
