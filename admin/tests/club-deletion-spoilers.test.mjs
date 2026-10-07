import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicationFields} from '../../supabase/functions/_shared/ugc-contract.mjs';
import {PGlite} from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222',club='33333333-3333-4333-8333-333333333333',post='44444444-4444-4444-8444-444444444444';
test('owner-only deletion cascades club content and retains personal data; spoiler update is atomic',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.reader',true),'')::uuid$$;
 create function novori_account_active(uuid) returns boolean language sql as $$select true$$;
 create function novori_reader_restricted(uuid) returns boolean language sql as $$select false$$;
 create table clubs(id uuid primary key,owner_id uuid);
 create table posts(id uuid primary key,author_id uuid,club_id uuid references clubs on delete cascade,body text);
 create table club_members(club_id uuid references clubs on delete cascade,user_id uuid);
 create table personal_books(user_id uuid,title text);
 create table novori_moderated_media(bucket text,path text);
 create function publish_reading_update_to_destination(target_google_book_id text,post_body text,checkpoint_page_number integer default null,target_club_id uuid default null) returns uuid language plpgsql as $$begin insert into posts(id,author_id,club_id,body) values('${post}',auth.uid(),target_club_id,post_body);return '${post}'::uuid;end$$;
 insert into clubs values('${club}','${owner}');insert into posts values('${post}','${other}','${club}','Club post');insert into club_members values('${club}','${other}');insert into personal_books values('${other}','Personal book');insert into novori_moderated_media values('club-covers','${owner}/${club}/cover.jpg'),('club-covers','${owner}/another/cover.jpg');`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261007013000_club_deletion_spoilers.sql',import.meta.url),'utf8'));
 await db.query("select set_config('test.reader',$1,false)",[other]);
 await assert.rejects(db.query('select novori_delete_club($1)',[club]),/Only the club owner/);
 assert.equal((await db.query('select count(*)::int n from clubs')).rows[0].n,1);
 await db.query("select set_config('test.reader',$1,false)",[owner]);
 await db.query('select novori_delete_club($1)',[club]);
 assert.equal((await db.query('select count(*)::int n from posts')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from club_members')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from personal_books')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from novori_club_media_cleanup')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from novori_moderated_media')).rows[0].n,1);
 await db.query('select novori_publish_reading_update($1::jsonb,true)',[JSON.stringify({target_google_book_id:'book',post_body:'Spoiler',checkpoint_page_number:null,target_club_id:null})]);
 assert.equal((await db.query('select contains_spoilers from posts')).rows[0].contains_spoilers,true);
 await db.exec('delete from posts;');
 await db.exec(`create function reject_spoiler_test() returns trigger language plpgsql as $$begin raise exception 'Test flag failure';end$$;create trigger reject_spoiler_test before update on posts for each row execute function reject_spoiler_test();`);
 await assert.rejects(db.query('select novori_publish_reading_update($1::jsonb,true)',[JSON.stringify({target_google_book_id:'book',post_body:'Rollback'})]),/Test flag failure/);
 assert.equal((await db.query('select count(*)::int n from posts')).rows[0].n,0);
 await db.exec('drop trigger reject_spoiler_test on posts;');
 await db.query("select set_config('test.reader','',false)");
 await assert.rejects(db.query('select novori_publish_reading_update($1::jsonb,true)',[JSON.stringify({target_google_book_id:'book',post_body:'Spoiler'})]),/Sign in/);
 assert.equal((await db.query('select count(*)::int n from posts')).rows[0].n,0);
 } finally {await db.close();}
});

test('reading update wrapper screens public content without private notes',()=>{
 assert.deepEqual(publicationFields('rpc/novori_publish_reading_update',{p_input:{post_body:'Visible thought',private_note_body:'Private note'},p_spoilers:true}),[{p_input:{post_body:'Visible thought'}}]);
});
