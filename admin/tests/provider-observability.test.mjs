import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('attempt ledger and counters are atomic, duplicate-safe and restricted; observations never go backwards',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table book_api_cache(id int primary key,hit_count bigint,last_hit_at timestamptz);
 create table counts(provider text primary key,n int);insert into counts values('hardcover',0),('isbndb',0);
 create function novori_record_hardcover_request() returns void language sql as 'update public.counts set n=n+1 where provider=''hardcover''';
 create function novori_claim_isbndb_request(p_user_id uuid) returns table(allowed boolean,reason text,retry_ms integer) language plpgsql as $$begin update public.counts set n=n+1 where provider='isbndb';return query select true,null::text,0;end$$;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261009200000_provider_observability.sql',import.meta.url),'utf8'));
 const id='00000000-0000-4000-8000-000000000001',isbnId='00000000-0000-4000-8000-000000000002';
 await db.query('select novori_begin_hardcover_request($1,$2)',[id,'series']);await db.query('select novori_begin_hardcover_request($1,$2)',[id,'series']);
 const first=await db.query('select * from novori_begin_isbndb_request(null,$1,$2)',[isbnId,'search']);const second=await db.query('select * from novori_begin_isbndb_request(null,$1,$2)',[isbnId,'search']);
 assert.equal(first.rows[0].allowed,true);assert.equal(second.rows[0].allowed,false);
 assert.deepEqual((await db.query('select n from counts order by provider')).rows.map(row=>row.n),[1,1]);
 assert.equal((await db.query('select count(*)::int n from novori_provider_request_log')).rows[0].n,2);
 for(const role of ['anon','authenticated'])assert.equal((await db.query(`select has_table_privilege('${role}','novori_provider_request_log','select') access`)).rows[0].access,false);
 const observation={provider:'hardcover',usage_date:'2026-10-09',reported_used:140,reported_limit:5000,remaining:4860,observed_at:'2026-10-09T18:00:00Z',source:'response_headers'};
 await db.query('select novori_store_provider_usage_observation($1)',[observation]);
 await db.query('select novori_store_provider_usage_observation($1)',[{...observation,reported_used:139,remaining:4861,observed_at:'2026-10-09T18:01:00Z'}]);
 await db.exec("insert into book_api_cache values(1,20,'2026-10-09T18:00:00Z');update book_api_cache set hit_count=0,last_hit_at=null where id=1;");
 assert.equal(Number((await db.query('select hit_count from book_api_cache')).rows[0].hit_count),20);
 assert.equal(Number((await db.query('select reported_used from novori_provider_usage_observations')).rows[0].reported_used),140);
 }finally{await db.close();}
});
