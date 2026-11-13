import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {safeAdminCover,coverOptions} from '../../supabase/functions/_shared/admin-book-covers.mjs';
import {dispatchAdmin} from '../../supabase/functions/_shared/admin-hub.mjs';
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;
create table book_works(id uuid primary key);
create table book_editions(id uuid primary key,work_id uuid,provider text,provider_book_id text,isbn_13 text,metadata jsonb);
create table book_cover_candidates(id uuid primary key default gen_random_uuid(),candidate_key text unique,work_id uuid,edition_id uuid,scope text,provider text,source_kind text,source_variant text,external_id text,url text,discovery_source text,source_metadata jsonb,last_seen_at timestamptz);
create table book_cover_selections(work_id uuid primary key,candidate_id uuid references book_cover_candidates(id),locked boolean default false,status text,selector_version integer,score numeric,decision_json jsonb);
create table novori_admin_members(user_id uuid,enabled boolean,role text);
create table novori_admin_audit(id uuid primary key default gen_random_uuid(),request_id uuid unique,request_hash text,actor_id uuid,action text,target_type text,target_id uuid,reason text,result jsonb);
create function novori_account_active(uuid) returns boolean language sql as $$select true$$;
create function novori_reader_restricted(uuid) returns boolean language sql as $$select false$$;
insert into novori_admin_members values('${id(1)}',true,'owner'),('${id(2)}',true,'support');
insert into book_works values('${id(10)}'),('${id(11)}');
insert into book_editions values('${id(20)}','${id(10)}','isbndb','nv_9780008710248','9780008710248','{"volumeInfo":{"title":"When the Moon Hatched"}}');
insert into book_cover_candidates(id,work_id,provider,url) values('${id(30)}','${id(10)}','isbndb','https://images.isbndb.com/old.jpg');
insert into book_cover_selections values('${id(10)}','${id(30)}',false,'selected',6,300,'{"mode":"canonical"}');`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261113010000_admin_cover_picker.sql',import.meta.url),'utf8'));
const snapshot=async()=> (await db.query('select novori_admin_book_cover_options($1) value',[id(10)])).rows[0].value;
async function apply({actor=id(1),expected,url='https://images.isbndb.com/new.jpg',request=id(40),undo=null,reason='Verified the correct cover'}={}) {
 return (await db.query('select novori_admin_set_book_cover($1,$2,$3,$4,$5,$6,$7) value',[actor,id(10),expected,url,reason,request,undo])).rows[0].value;
}
test('safe cover URLs exclude credentials, temporary signatures, ports and arbitrary hosts',()=>{
 for(const url of ['http://images.isbndb.com/a','https://evil.test/a','https://assets.hardcover.app:444/a','https://user@images.isbndb.com/a','https://images.isbndb.com/a?token=secret','javascript:alert(1)'])assert.equal(safeAdminCover(url),null);
 assert.equal(safeAdminCover('https://images.isbndb.com/a.jpg'),'https://images.isbndb.com/a.jpg');
});
test('cached preview deduplicates images without writing to the catalog',()=>{
 const s={editions:[{id:id(20),provider:'isbndb',isbn_13:'9780008710248',metadata:{volumeInfo:{title:'Book',imageLinks:{large:'https://images.isbndb.com/a',thumbnail:'https://images.isbndb.com/a'}}}}],candidates:[{url:'https://images.isbndb.com/a',provider:'isbndb'}]};
 const copy=structuredClone(s);assert.equal(coverOptions(s).length,1);assert.deepEqual(s,copy);
});
test('support cannot read picker, fetch providers, save or undo',async()=>{
 for(const action of ['book_cover_options','find_book_covers','set_book_cover','undo_book_cover'])await assert.rejects(dispatchAdmin({}, {member:{role:'support'},user:{id:id(2)}},{action}),/Moderator access/);
});
test('correction is locked, audited and idempotent; stale saves and invalid URLs fail; undo restores exact prior selection',async()=>{
 const before=await snapshot();
 await assert.rejects(apply({actor:id(2),expected:before.revision}),/Moderator access/);
 await assert.rejects(apply({expected:before.revision,url:'https://evil.test/a'}),/supported book provider/);
 const result=await apply({expected:before.revision});
 assert.deepEqual(await apply({expected:before.revision}),result);
 const after=await snapshot();assert.equal(after.selection.locked,true);assert.equal(after.selection.url,'https://images.isbndb.com/new.jpg');
 assert.equal(after.history.length,1);assert.equal((await db.query('select count(*) from novori_admin_audit')).rows[0].count,1);
 await assert.rejects(apply({expected:before.revision,request:id(41)}),/Cover changed/);
 await apply({expected:after.revision,request:id(42),undo:result.change_id,url:null});
 const restored=await snapshot();assert.deepEqual(restored.selection,before.selection);
 assert.equal(restored.history.length,2);
 await assert.rejects(apply({expected:restored.revision,request:id(43),undo:result.change_id,url:null}),/unchanged last correction/);
 assert.equal((await db.query('select count(*) from book_editions')).rows[0].count,1);
});
test('ordinary readers cannot execute picker writes or read correction history',async()=>{
 await db.exec('set role authenticated');try{
 await assert.rejects(db.query('select novori_admin_book_cover_options($1)',[id(10)]),/permission denied/);
 await assert.rejects(db.query('select * from novori_admin_cover_changes'),/permission denied/);
 }finally{await db.exec('reset role');}
});
test('close cover test database',async()=>{await db.close();});
