import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(), id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create table public.profiles(id uuid primary key,username text,display_name text,bio text,avatar_url text);
create table public.posts(id uuid primary key,author_id uuid,body text,post_image_url text);
create table public.post_comments(id uuid primary key,author_id uuid,body text);
create table public.user_books(id uuid primary key,review_text text,status text,private_note text);
create table public.book_stacks(id uuid primary key,name text,description text);
create table public.clubs(id uuid primary key,name text,description text,rules text,cover_url text);
create table public.club_discussions(id uuid primary key,title text,prompt text,options jsonb,spoiler_label text);
create table public.club_events(id uuid primary key,title text,description text,location text,meeting_url text);
create table public.content_reports(id uuid primary key,reporter_id uuid,target_type text,target_id uuid,reason text,status text default 'pending',created_at timestamptz default now(),updated_at timestamptz default now());
create table public.novori_admin_members(user_id uuid primary key,role text,enabled boolean default true,email_alerts boolean default true);
create table public.novori_admin_audit(request_id uuid primary key,request_hash text,actor_id uuid,action text,target_type text,target_id uuid,reason text,result jsonb);
create table public.notifications(id uuid default gen_random_uuid(),recipient_id uuid,type text,title text,body text);
create function public.novori_account_active(reader_id uuid) returns boolean language sql as $$select exists(select 1 from auth.users where id=reader_id)$$;
create function public.novori_reader_restricted(p_user uuid) returns boolean language sql as $$select false$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
create policy legacy_storage_read on storage.objects for select to anon,authenticated using(true);
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant select,insert,update,delete on all tables in schema public,storage,auth to authenticated,service_role;`);
const migration=await readFile(new URL('../../supabase/migrations/20261005180000_ugc_screening.sql',import.meta.url),'utf8');
await db.exec(migration);
for(let n=1;n<=10;n++)await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`r${n}@example.test`]);
await db.query("insert into novori_admin_members(user_id,role) values($1,'owner'),($2,'moderator'),($3,'support')",[id(1),id(2),id(3)]);
async function claims(user=id(4),path='/posts',role='authenticated',ticket=null) {
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('request.path',$3,false),set_config('request.headers',$4,false)",[user??'',JSON.stringify({role}),path,JSON.stringify(ticket?{'x-novori-moderation-ticket':ticket}:{})]);
}
async function reset(){await db.exec('reset role');await claims(null,'','service_role');}
async function value(sql,args=[]){return (await db.query(sql,args)).rows[0].v;}
test('screening migration is repeatable, staged off, with private quarantine',async()=>{
 await db.exec(migration);assert.equal(await value('select enforcement_enabled v from novori_moderation_config'),false);
 assert.equal(await value("select public v from storage.buckets where id='moderation-quarantine'"),false);
 await db.exec('update novori_moderation_config set enforcement_enabled=true');
});
test('direct text writes fail; receipts are bound to reader, path and expiry',async()=>{
 await claims();await assert.rejects(db.query('insert into posts(id,body) values($1,$2)',[id(100),'unscreened']),/safety checks/);
 await reset();const key='a'.repeat(64);
 await db.query("select novori_record_screening($1,$2,'posts','[{\"body\":\"A book\"}]',false,'{}','test',null)",[id(4),key]);
 const ticket=await value('select novori_issue_publication_ticket($1,$2,$3,$4) v',[id(4),'/posts',key,'version']);
 await claims(id(5),'/posts','authenticated',ticket);await assert.rejects(db.query('insert into posts(id,body) values($1,$2)',[id(100),'wrong user']),/safety checks/);
 await claims(id(4),'/profiles','authenticated',ticket);await assert.rejects(db.query('insert into posts(id,body) values($1,$2)',[id(100),'wrong path']),/safety checks/);
 await claims(id(4),'/posts','authenticated',ticket);await db.query('insert into posts(id,body) values($1,$2)',[id(100),'A book']);
 await reset();await db.query("update novori_publication_tickets set expires_at=now()-interval '1 second' where id=$1",[ticket]);
 await claims(id(4),'/posts','authenticated',ticket);await assert.rejects(db.query('update posts set body=$1 where id=$2',['expired',id(100)]),/safety checks/);
 await reset();
});
test('private notes/status writes are unaffected; removal RPCs preserve lifecycle',async()=>{
 await claims();await db.query('insert into user_books(id,status,private_note) values($1,$2,$3)',[id(101),'reading','private diary']);
 await assert.rejects(db.query('update user_books set review_text=$1 where id=$2',['public review',id(101)]),/safety checks/);
 await reset();await db.query('insert into post_comments(id,body,author_id) values($1,$2,$3)',[id(102),'original',id(4)]);
 await claims(id(4),'/rpc/delete_post_comment');await db.query("update post_comments set body='This comment was deleted.',author_id=null where id=$1",[id(102)]);
 await claims(id(4),'/rpc/request_account_deletion');await db.query("insert into profiles(id,username) values($1,'Unavailable reader')",[id(4)]);
 await claims(id(4),'/rpc/cancel_account_deletion');await db.query("update profiles set username='restored' where id=$1",[id(4)]);await reset();
});
test('direct image upload and overwrite fail independently of bucket policies',async()=>{
 await claims(id(4),'/storage/v1/object/avatars');await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('avatars','unsafe')"),/safety checks/);
 await reset();await db.exec("insert into storage.objects(bucket_id,name) values('avatars','approved')");
 await claims(id(4),'/storage/v1/object/avatars');await assert.rejects(db.exec("update storage.objects set name='overwrite' where name='approved'"),/safety checks/);await reset();
});
test('signed-in raw Storage reads cannot bypass image delivery even under a broad legacy policy',async()=>{
 await claims();await db.exec('set role authenticated');assert.equal(await value("select count(*) v from storage.objects where bucket_id='avatars'"),0);await reset();
});
test('readers cannot read receipts, quarantine metadata or approve themselves',async()=>{
 await claims();await db.exec('set role authenticated');
 await assert.rejects(db.exec('select * from novori_publication_tickets'),/permission denied/);
 await assert.rejects(db.query("select novori_admin_review_screening($1,$2,now(),'approved','self approval',$3)",[id(4),id(300),id(301)]),/permission denied/);await reset();
});
test('report priority counts distinct open reporters; dismissal lowers priority',async()=>{
 for(let n=1;n<=7;n++)await db.query("insert into content_reports(id,reporter_id,target_type,target_id,reason) values($1,$2,'post',$3,'harassment')",[id(200+n),id(n>5?5:n),id(100)]);
 assert.equal(await value("select distinct_reporters v from novori_report_priority limit 1"),5);
 assert.equal(await value("select priority v from novori_report_priority limit 1"),'urgent');
 await db.query("update content_reports set status='dismissed' where reporter_id in ($1,$2)",[id(1),id(2)]);
 assert.equal(await value('select distinct_reporters v from novori_report_priority limit 1'),3);
 assert.equal(await value('select priority v from novori_report_priority limit 1'),'high');
});
test('pending approvals require moderator/revision and permit only exact resubmission',async()=>{
 const row=(await db.query("select novori_record_screening($1,$2,'posts','[{\"body\":\"flagged\"}]',true,'{\"harassment\":true}','test',null) v",[id(4),'b'.repeat(64)])).rows[0].v;
 const timestamp=await value('select updated_at v from novori_content_screenings where id=$1',[row.id]);
 await assert.rejects(db.query("select novori_admin_review_screening($1,$2,$3,'approved','reviewed context',$4)",[id(3),row.id,timestamp,id(310)]),/Moderator required/);
 await assert.rejects(db.query("select novori_admin_review_screening($1,$2,now()+interval '1 day','approved','reviewed context',$3)",[id(1),row.id,id(310)]),/Review changed/);
 await db.query("select novori_admin_review_screening($1,$2,$3,'approved','reviewed context',$4)",[id(2),row.id,timestamp,id(310)]);
 assert.equal(await value('select state v from novori_content_screenings where id=$1',[row.id]),'approved');
 assert.equal(await value("select count(*) v from notifications where recipient_id=$1",[id(4)]),1);
 assert.equal(await value('select count(*) v from posts'),1);
});
test('signup rejects bypass, consumes only name/email-bound receipts and strips secret metadata',async()=>{
 await assert.rejects(db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(20),'new@example.test','{}']),/updated Novori signup/);
 const names={username:'newreader',display_name:'New Reader'};
 const ticket=await value('select novori_issue_registration_ticket($1,$2,$3) v',['new@example.test',JSON.stringify(names),'v2']);
 const metadata={...names,novori_registration_ticket:ticket,terms_version:'v2',privacy_version:'v2',adult_confirmed:true};
 await assert.rejects(db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(20),'wrong@example.test',JSON.stringify(metadata)]),/updated Novori signup/);
 await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(20),'new@example.test',JSON.stringify(metadata)]);
 assert.equal((await value('select raw_user_meta_data v from auth.users where id=$1',[id(20)])).novori_registration_ticket,undefined);
 assert.equal(await value('select count(*) v from novori_registration_tickets where id=$1',[ticket]),0);
});
test('removing a photo post revokes its asset; reported profile images can be removed',async()=>{
 await db.query("insert into novori_moderated_media(bucket,path,user_id,sha256) values('post-media',$1,$2,'hash'),('avatars',$3,$2,'hash')",[`${id(4)}/photo.jpg`,id(4),`${id(4)}/avatar.jpg`]);
 await db.query('update posts set post_image_url=$1 where id=$2',[`https://project.supabase.co/storage/v1/object/public/post-media/${id(4)}/photo.jpg`,id(100)]);
 await db.query('delete from posts where id=$1',[id(100)]);
 assert.equal(await value("select blocked v from novori_moderated_media where bucket='post-media'"),true);
 await db.query('update profiles set avatar_url=$1 where id=$2',[`https://project.supabase.co/storage/v1/object/public/avatars/${id(4)}/avatar.jpg`,id(4)]);
 await db.query("insert into content_reports(id,reporter_id,target_type,target_id,reason) values($1,$2,'profile',$3,'explicit_content')",[id(250),id(5),id(4)]);
 const revision=await value('select updated_at v from content_reports where id=$1',[id(250)]);
 await db.query('select novori_admin_block_reported_image($1,$2,$3,$4,$5)',[id(1),id(250),revision,'Image violates rules',id(251)]);
 assert.equal(await value("select blocked v from novori_moderated_media where bucket='avatars'"),true);
 assert.equal(await value('select avatar_url v from profiles where id=$1',[id(4)]),null);
});
test('close moderation database',async()=>db.close());
