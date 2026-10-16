import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key);
create table public.book_works(id uuid primary key);
create table public.book_editions(id uuid primary key,work_id uuid,provider text,provider_book_id text,metadata jsonb);
create table public.novori_admin_members(user_id uuid,enabled boolean default true,role text);
create table public.novori_admin_audit(id uuid primary key default gen_random_uuid(),request_id uuid unique,request_hash text,actor_id uuid,action text,target_type text,target_id uuid,reason text,result jsonb);
create function public.novori_account_active(uuid) returns boolean language sql as $$select $1 is not null and $1 <> '${id(4)}'::uuid$$;
create function public.novori_reader_restricted(uuid) returns boolean language sql as $$select $1 = '${id(3)}'::uuid$$;
grant usage on schema public,auth to anon,authenticated,service_role;
`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261016010000_book_artwork_reports.sql',import.meta.url),'utf8'));
for (let n=1;n<=30;n++) await db.query('insert into auth.users values($1)',[id(n)]);
await db.query("insert into novori_admin_members(user_id,role) values($1,'owner'),($2,'moderator'),($3,'support')",[id(1),id(2),id(5)]);
for (const n of [100,101]) await db.query('insert into book_works values($1)',[id(n)]);
for (const [n,work,book] of [[200,100,'nv_9781408884430'],[201,100,'nv_9781635574074'],[202,101,'nv_other']])
 await db.query("insert into book_editions values($1,$2,'isbndb',$3,$4)",[id(n),id(work),book,JSON.stringify({volumeInfo:{title:work===100?'House of Sky and Breath':'Another Book',authors:['Sarah J. Maas']}})]);
async function asReader(user,fn) {
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??'']);
 await db.exec('set role authenticated');
 try { return await fn(); } finally { await db.exec('reset role'); }
}
async function report(user,book='nv_9781408884430',reason='blurry_cover',url='https://images.example/old.jpg') {
 return asReader(user,async()=> (await db.query('select public.submit_book_artwork_report($1,$2,$3) id',[book,reason,url])).rows[0].id);
}
async function queue(work=100) {return (await db.query('select * from novori_book_artwork_report_queue where work_id=$1',[id(work)])).rows[0];}
async function review({actor=1,work=100,revision,decision='resolved',request=300,reason='Verified the replacement artwork'}={}) {
 return (await db.query('select public.novori_admin_review_book_artwork($1,$2,$3,$4,$5,$6) result',[id(actor),id(work),revision,decision,reason,id(request)])).rows[0].result;
}
test('intake requires an active signed-in reader and a real catalog book',async()=>{
 for(const user of [null,id(3),id(4)]) await assert.rejects(report(user),/active account/);
 await assert.rejects(report(id(10),'made-up-book'),/not available/);
 await assert.rejects(report(id(10),'nv_other','spam'),/valid book/);
 await assert.rejects(report(id(10),'nv_other','wrong_cover','javascript:alert(1)'),/Invalid cover URL/);
});
test('linked editions and repeated submissions count once per reader, with no metadata writes',async()=>{
 const before=(await db.query('select * from book_editions order by id')).rows;
 const first=await report(id(10));
 assert.equal(first,await report(id(10)));
 assert.equal(first,await report(id(10),'nv_9781635574074','wrong_cover'));
 await report(id(11));
 const row=await queue();
 assert.equal(row.report_count,2);assert.equal(row.pending_count,2);
 assert.equal(row.wrong_cover_count,1);assert.equal(row.blurry_cover_count,1);
 assert.deepEqual((await db.query('select * from book_editions order by id')).rows,before);
});
test('reader cannot list other reports, inspect the admin queue or resolve reports',async()=>{
 const revision=(await queue()).revision;
 await asReader(id(10),async()=>{
  await assert.rejects(db.query('select * from book_artwork_reports'),/permission denied/);
  await assert.rejects(db.query('select * from novori_book_artwork_report_queue'),/permission denied/);
  await assert.rejects(review({revision}),/permission denied/);
 });
});
test('support cannot resolve and new reports invalidate a stale administrator decision',async()=>{
 const old=await queue();
 await assert.rejects(review({actor:5,revision:old.revision}),/Moderator access/);
 await report(id(12));
 await assert.rejects(review({revision:old.revision}),/Reports changed/);
});
test('resolution is grouped, audited and idempotent; a new report reopens the same book',async()=>{
 const row=await queue();
 const result=await review({revision:row.revision});
 assert.equal(result.reports_updated,3);
 assert.deepEqual(await review({revision:row.revision}),result);
 assert.equal((await queue()).pending_count,0);
 assert.equal((await db.query('select count(*)::int n from novori_admin_audit')).rows[0].n,1);
 await report(id(10));
 const reopened=await queue();assert.equal(reopened.report_count,3);assert.equal(reopened.pending_count,1);assert.equal(reopened.status,'pending');
 await report(id(11),'nv_other');
 assert.equal((await db.query('select count(*)::int n from novori_book_artwork_report_queue')).rows[0].n,2);
});
test.after(async()=>{await db.close();});
