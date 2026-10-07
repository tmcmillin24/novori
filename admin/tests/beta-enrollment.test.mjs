import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const owner='dea7ea0c-799d-4424-b5cf-81f1ffb370e7',club='a50f11a3-7909-4894-bbca-56d444802974';
const id=n=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration=await readFile(new URL('../../supabase/migrations/20261007023000_beta_enrollment.sql',import.meta.url),'utf8');
test('beta allocation is limited, atomic, new-account-only, optional after 15 and never restored on retry',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb,created_at timestamptz default now());
 create table profiles(id uuid primary key references auth.users(id) on delete cascade);
 create table clubs(id uuid primary key,name text,owner_id uuid references profiles(id));
 create table club_members(club_id uuid references clubs(id) on delete cascade,user_id uuid references profiles(id) on delete cascade,role text,primary key(club_id,user_id));
 create table follows(follower_id uuid references profiles(id) on delete cascade,following_id uuid references profiles(id) on delete cascade,primary key(follower_id,following_id));
 create table blocked(a uuid,b uuid);
 create function public.is_reader_blocked_between(p_a uuid,p_b uuid) returns boolean language sql set search_path=public as $$select exists(select 1 from public.blocked x where (x.a=p_a and x.b=p_b) or (x.a=p_b and x.b=p_a))$$;
 create function public.novori_account_active(uuid) returns boolean language sql as $$select true$$;
 create function public.novori_reader_restricted(uuid) returns boolean language sql as $$select false$$;
 insert into auth.users values('${owner}','{}',now()-interval '1 day');insert into profiles values('${owner}');
 insert into clubs values('${club}','Novori Beta Testers','${owner}');`);
 await db.exec(migration);
 assert.equal((await db.query('select novori_beta_signup_status() as status')).rows[0].status.phase,'closed');
 await db.exec(`update novori_beta_campaign set enabled=true,activated_at=now();`);
 const add=async(n,opt=false,notice=true,old=false)=>db.transaction(async tx=>{
  await tx.query("insert into auth.users(id,raw_user_meta_data,created_at) values($1,$2,case when $3 then now()-interval '1 day' else now() end)",[id(n),JSON.stringify({novori_beta_opt_in:opt,...(notice?{novori_beta_notice_version:'2026-10-07-v1'}:{})}),old]);
  await tx.query('insert into profiles values($1)',[id(n)]);
 });
 await add(99,false,false,true);
 assert.equal((await db.query('select allocated from novori_beta_campaign')).rows[0].allocated,0);
 await assert.rejects(add(98,false,false),/review beta enrollment/);
 assert.equal((await db.query('select count(*)::int as n from auth.users where id=$1',[id(98)])).rows[0].n,0);
 for(let n=1;n<=15;n++)await add(n);
 assert.equal((await db.query('select count(*)::int as n from club_members')).rows[0].n,15);
 assert.equal((await db.query('select novori_beta_signup_status() as status')).rows[0].status.phase,'optional');
 await add(16,false);await add(17,true);
 assert.equal((await db.query('select enrolled from novori_beta_accounts where slot=16')).rows[0].enrolled,false);
 assert.equal((await db.query('select count(*)::int as n from follows where follower_id=$1',[id(17)])).rows[0].n,16);
 await db.query('delete from follows where follower_id=$1 and following_id=$2',[id(1),id(2)]);
 await db.query('delete from club_members where user_id=$1',[id(3)]);
 await add(18,true);
 assert.equal((await db.query('select count(*)::int as n from follows where follower_id=$1 and following_id=$2',[id(1),id(2)])).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int as n from follows where follower_id=$1 and following_id=$2',[id(18),id(3)])).rows[0].n,0);
 await db.query('delete from auth.users where id=$1',[id(4)]);
 assert.equal((await db.query('select user_id from novori_beta_accounts where slot=4')).rows[0].user_id,null);
 // A blocked follow does not make signup fail or recreate an unavailable link.
 await db.query('insert into blocked values($1,$2)',[id(19),id(1)]);await add(19,true);
 assert.equal((await db.query('select count(*)::int as n from follows where follower_id=$1 and following_id=$2',[id(19),id(1)])).rows[0].n,0);
 for(let n=20;n<=50;n++)await add(n,false);
 await add(51,true,false);
 assert.equal((await db.query('select allocated from novori_beta_campaign')).rows[0].allocated,50);
 assert.equal((await db.query('select count(*)::int as n from novori_beta_accounts')).rows[0].n,50);
 assert.equal((await db.query('select count(*)::int as n from club_members where user_id=$1',[id(51)])).rows[0].n,0);
 assert.equal((await db.query('select novori_beta_signup_status() as status')).rows[0].status.phase,'closed');
 await db.exec(migration);assert.equal((await db.query('select allocated from novori_beta_campaign')).rows[0].allocated,50);
 await db.exec('set role anon;');
 await assert.rejects(db.exec('select * from novori_beta_accounts'),/permission denied/);
 await assert.rejects(db.exec('update novori_beta_campaign set allocated=0'),/permission denied/);
 await db.exec('reset role;');
 // Removing the club must retain the existing owner-only deletion capability.
 await db.query('delete from clubs where id=$1',[club]);
 assert.equal((await db.query('select novori_beta_signup_status() as status')).rows[0].status.phase,'closed');
 }finally{await db.close();}
});
