import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('ISBNdb quota is global, atomic, service-only, bounded, and safe to rerun', async () => {
 const db = new PGlite();
 try {
  await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create table public.book_editions(provider text check(provider in ('google_books','hardcover')),title text check(length(title)>0));");
  const sql = await readFile(new URL('../../supabase/migrations/20261005130000_isbndb_provider.sql',import.meta.url),'utf8');
  await db.exec(sql);
  await db.exec("insert into book_editions values('isbndb','Valid');");
  await assert.rejects(db.exec("insert into book_editions values('unapproved','Valid');"));
  await assert.rejects(db.exec("insert into book_editions values('isbndb','');"));
  const uid='dea7ea0c-799d-4424-b5cf-81f1ffb370e7';
  await db.query('insert into auth.users values($1)',[uid]);
  const claim=async()=> (await db.query('select * from novori_claim_isbndb_request($1)',[uid])).rows[0];
  assert.equal((await claim()).allowed,true);
  const concurrent = await Promise.all(Array.from({length:5},claim));
  assert.ok(concurrent.every(row=>!row.allowed && row.reason==='rate_limit' && row.retry_ms>0));
  assert.equal(Number((await db.query('select upstream_requests from novori_isbndb_usage_daily')).rows[0].upstream_requests),1);
  await db.exec(sql);
  assert.equal(Number((await db.query('select upstream_requests from novori_isbndb_usage_daily')).rows[0].upstream_requests),1);
  await db.exec("update novori_isbndb_usage_daily set next_request_at='-infinity';update novori_isbndb_user_usage set upstream_requests=250;");
  assert.equal((await claim()).reason,'reader_daily_quota');
  await db.exec('update novori_isbndb_usage_daily set upstream_requests=4500;');
  assert.equal((await claim()).reason,'daily_quota');
  for(const role of ['anon','authenticated']) {
   const p=(await db.query(`select has_function_privilege('${role}','novori_claim_isbndb_request(uuid)','execute') fn,has_table_privilege('${role}','novori_book_provider_ids','select') tbl`)).rows[0];
   assert.equal(p.fn,false);assert.equal(p.tbl,false);
  }
  await db.query('delete from auth.users where id=$1',[uid]);
  assert.equal((await db.query('select * from novori_isbndb_user_usage')).rows.length,0);
 }finally{await db.close();}
});
