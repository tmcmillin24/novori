// Isolated PostgreSQL verification. No production connections.
// npm install --prefix /tmp/novori-push-check @electric-sql/pglite@0.5.8
// NOVORI_PGLITE_MODULE=/tmp/novori-push-check/node_modules/@electric-sql/pglite node scripts/verify-phone-push.cjs
const { PGlite } = require(process.env.NOVORI_PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const db = new PGlite();
 const a='00000000-0000-0000-0000-000000000001', b='00000000-0000-0000-0000-000000000002', install='00000000-0000-0000-0000-000000000003', project='30e6f9f0-79ba-4420-9217-433fa022e460';
 const secret='a'.repeat(64);
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
 create table auth.users(id uuid primary key); insert into auth.users values ('${a}'),('${b}');
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.novori_account_active(uuid) returns boolean language sql as $$select true$$;
 create function public.novori_reader_restricted(uuid) returns boolean language sql as $$select false$$;
 create function public.is_reader_blocked_by_viewer(uuid) returns boolean language sql as $$select false$$;
 create table public.notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid references auth.users(id),actor_id uuid,type text,title text,body text,entity_type text,entity_id uuid,metadata jsonb default '{}',read_at timestamptz,created_at timestamptz default now());
 create table public.profiles(id uuid primary key,display_name text);
 insert into public.profiles values ('${b}','Tristan');
 create table public.notification_preferences(user_id uuid primary key,new_followers boolean default true,reactions_and_replies boolean default true,club_activity boolean default true,club_invites boolean default true,reading_started boolean default true,reading_finished boolean default true);
 create table public.reading_reminder_preferences(user_id uuid primary key,daily_checkin boolean,still_reading boolean,weekly_recap boolean,monthly_recap boolean);
 create function public.get_club_member_experience(target_club_id uuid) returns jsonb language sql as $$select '{"notifications_enabled":false,"global_notifications_enabled":true}'::jsonb$$;
 select set_config('request.jwt.claim.sub','${a}',false);`);
 const sql=fs.readFileSync('supabase/migrations/20261113020000_phone_push.sql','utf8');
 await db.exec(sql); await db.exec(sql);
 const repair=fs.readFileSync('supabase/migrations/20261113030000_push_registration_reinstall.sql','utf8');
 await db.exec(repair); await db.exec(repair);
 const previews=fs.readFileSync('supabase/migrations/20261113040000_push_activity_previews.sql','utf8');
 await db.exec(previews); await db.exec(previews);
 await db.exec(fs.readFileSync('supabase/migrations/20261113060000_push_inbox_wording.sql','utf8'));
 const scalar=async(sql,args)=>Object.values((await db.query(sql,args)).rows[0])[0];
 const register=()=>db.query('select public.novori_register_push_device($1,$2,$3,$4,$5)',[install,secret,'ExpoPushToken[valid-test]','ios',project]);
 await register();
 const generation=await scalar('select generation from public.novori_push_devices');
 await register(); assert.equal(await scalar('select generation from public.novori_push_devices'),generation,'repeat registration must not invalidate queued messages');
 await assert.rejects(()=>db.query('select public.novori_register_push_device($1,$2,$3,$4,$5)',[install,'b'.repeat(64),'ExpoPushToken[valid-test]','ios',project]));
 const notification=await scalar(`insert into public.notifications(recipient_id,type,title) values('${a}','follow','A new follower') returning id`);
 assert.equal(await scalar('select count(*)::int from public.novori_push_outbox'),1);
 const claimed=await scalar('select public.novori_claim_push()'); assert.equal(claimed.length,1);
 assert.equal(await scalar('select public.novori_push_still_valid($1,$2)',[claimed[0].id,claimed[0].lease]),true);
 assert.deepEqual(await scalar('select public.novori_claim_push()'),[],'leases prevent duplicate claiming');
 // Account transfer rotates generation and makes old queued job invalid.
 await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);await register();
 assert.equal(await scalar('select public.novori_push_still_valid($1,$2)',[claimed[0].id,claimed[0].lease]),false);
 await db.query('select public.novori_finish_push($1,$2,$3,$4,$5)',[claimed[0].id,claimed[0].lease,'failed',null,'DeviceNotRegistered']);
 assert.equal(await scalar('select enabled from public.novori_push_devices'),true,'old receipt must not disable a newly registered account');
 await db.exec(`select set_config('request.jwt.claim.sub','${a}',false)`);await register();
 await db.exec(`insert into public.notification_preferences(user_id,new_followers) values('${a}',false); insert into public.notifications(recipient_id,type,title) values('${a}','follow','Muted follower');`);
 assert.deepEqual(await scalar('select public.novori_claim_push()'),[],'preference opt-out suppresses delivery');
 await db.exec(`insert into public.reading_reminder_preferences values('${a}',false,false,true,true);
 insert into public.notifications(recipient_id,type,title,entity_type,metadata) values('${a}','system','Weekly recap','reading_reminder','{"reading_reminder_kind":"weekly_recap"}');`);
 const recap=await scalar('select public.novori_claim_push()'); assert.equal(recap.length,1);assert.equal(recap[0].title,'Weekly recap');
 await db.query('select public.novori_finish_push($1,$2,$3,$4,$5)',[recap[0].id,recap[0].lease,'receipt','ticket-1',null]);
 assert.deepEqual(await scalar('select public.novori_claim_push()'),[],'receipt must wait before polling');
 await db.exec(`update public.novori_push_outbox set available_at=now()-interval '1 second' where state='receipt'`);
 const receipt=await scalar('select public.novori_claim_push()');assert.equal(receipt[0].state,'checking');
 await db.query('select public.novori_finish_push($1,$2,$3,$4,$5)',[receipt[0].id,receipt[0].lease,'delivered',null,null]);
 await db.exec(`insert into public.notifications(recipient_id,type,title,entity_type,entity_id) values('${a}','club_post','Muted club','club','${b}');`);
 assert.deepEqual(await scalar('select public.novori_claim_push()'),[],'per-club mute must suppress delivery');
 assert.equal(await scalar("select current_setting('request.jwt.claim.sub')"),a,'club preference check must restore auth context');
 await db.query('select public.novori_unregister_push_device($1,$2)',[install,'b'.repeat(64)]);
 assert.equal(await scalar('select enabled from public.novori_push_devices'),true,'invalid proof cannot unregister');
 await db.exec("select set_config('request.jwt.claim.sub','',false)");
 await db.query('select public.novori_unregister_push_device($1,$2)',[install,secret]);
 assert.equal(await scalar('select enabled from public.novori_push_devices'),false,'logout proof works without a session');
 await db.exec('set role authenticated');
 await assert.rejects(()=>db.query('select * from public.novori_push_devices'));
 await assert.rejects(()=>db.query('select public.novori_claim_push()'));
 await db.exec('reset role');
 // Re-enable; test self-notification is rate limited; read items never dispatch.
 await db.exec(`select set_config('request.jwt.claim.sub','${a}',false)`); await register();
 await db.exec('select public.novori_test_push(); select public.novori_test_push();');
 assert.equal(await scalar("select count(*)::int from public.notifications where entity_type='push_test'"),1);
 await db.exec(`update public.notifications set read_at=now() where entity_type='push_test'`);
 assert.deepEqual(await scalar('select public.novori_claim_push()'),[]);
 const replacement='00000000-0000-0000-0000-000000000004';
 await db.query('select public.novori_register_push_device($1,$2,$3,$4,$5)',[replacement,'c'.repeat(64),'ExpoPushToken[valid-test]','ios',project]);
 assert.equal(await scalar('select count(*)::int from public.novori_push_devices where enabled and expo_token is not null'),1,'reinstall must replace the same owners old token binding');
 assert.equal(await scalar('select enabled from public.novori_push_devices where install_id=$1',[install]),false);
 await db.query('select public.novori_unregister_push_device($1,$2)',[install,secret]);
 assert.equal(await scalar('select enabled from public.novori_push_devices where install_id=$1',[replacement]),true,'old installation cleanup cannot disable its replacement');
 await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
 await assert.rejects(()=>register(),error=>error.code==='42501','another account cannot take a token from an installation without its proof');
 // Structured previews must never reuse user-authored comment text.
 await db.exec(`select set_config('request.jwt.claim.sub','${a}',false); truncate public.novori_push_outbox;`);
 const comment=await scalar(`insert into public.notifications(recipient_id,actor_id,type,title,body,entity_type,entity_id)
 values('${a}','${b}','comment','Tristan commented on your post.','PRIVATE COMMENT','post','${b}') returning id`);
 assert.equal(await scalar('select public.novori_push_preview($1)',[comment]),'Tristan commented on your post.');
 const postVote=await scalar(`insert into public.notifications(recipient_id,actor_id,type,title,body,entity_type,entity_id,metadata) values('${a}','${b}','post_vote','Tristan upvoted your post','PRIVATE BODY','post','${a}','{"vote_value":1}') returning id`);
 assert.equal(await scalar('select public.novori_push_preview($1)',[postVote]),'Tristan upvoted your post');
 await db.query('delete from public.notifications where id=$1',[postVote]);
 const commentJobs=await scalar('select public.novori_claim_push()');assert.equal(commentJobs.length,1);assert.equal(commentJobs[0].body,'Tristan commented on your post.');
 await db.query('select public.novori_finish_push($1,$2,$3,$4,$5)',[commentJobs[0].id,commentJobs[0].lease,'delivered',null,null]);
 await db.exec(`insert into public.notifications(recipient_id,actor_id,type,title,entity_type,entity_id,metadata)
 values('${a}','${b}','comment_vote','Tristan voted','comment','${b}','{"vote_value":1,"comment_id":"${b}"}'),
 ('${a}','${b}','comment_vote','Tristan voted again','comment','${b}','{"vote_value":1,"comment_id":"${b}"}'),
 ('${a}','${b}','comment_vote','Tristan downvoted','comment','${b}','{"vote_value":-1,"comment_id":"${b}"}'),
 ('${a}','${b}','comment_vote','Unknown vote','comment','${b}','{}');`);
 assert.equal(await scalar("select count(*)::int from public.novori_push_outbox where vote_group is not null"),1,'same target and window must coalesce');
 assert.equal(await scalar("select vote_events from public.novori_push_outbox where vote_group is not null"),2,'downvotes and unknown direction must not queue');
 assert.deepEqual(await scalar('select public.novori_claim_push()'),[],'upvotes must wait for batching delay');
 await db.exec("update public.novori_push_outbox set available_at=now()-interval '1 second' where vote_group is not null");
 const votes=await scalar('select public.novori_claim_push()');assert.equal(votes.length,1);assert.equal(votes[0].body,'Your comment received new upvotes.');assert.ok(!JSON.stringify(votes[0]).includes('Tristan'));
 await db.query('select public.novori_finish_push($1,$2,$3,$4,$5)',[votes[0].id,votes[0].lease,'receipt','vote-ticket',null]);
 await db.exec(`insert into public.notifications(recipient_id,actor_id,type,title,entity_type,entity_id,metadata)
 values('${a}','${b}','comment_vote','Another upvote','comment','${b}','{"vote_value":1,"comment_id":"${b}"}');`);
 assert.deepEqual(await scalar('select public.novori_claim_push()'),[],'already dispatched batch must not send again in same window');
 const single=await scalar(`insert into public.notifications(recipient_id,actor_id,type,title,entity_type,entity_id,metadata)
 values('${a}','${b}','comment_vote','An upvote','comment','${a}','{"vote_value":1,"comment_id":"${a}"}') returning id`);
 assert.equal(await scalar('select public.novori_push_preview($1)',[single]),'Someone upvoted your comment.');
 await db.query("update public.notifications set metadata=jsonb_set(metadata,'{vote_value}','-1') where id=$1",[single]);
 await db.exec("update public.novori_push_outbox set available_at=now()-interval '1 second' where state='pending'");
 assert.deepEqual(await scalar('select public.novori_claim_push()'),[],'a vote changed to down must be suppressed at dispatch');
 await db.exec('set role authenticated');
 await assert.rejects(()=>db.query('select public.novori_push_preview($1)',[comment]));
 await db.exec('reset role');
 // Author deletion never cascades away another reader's reply.
 await db.exec(`create table public.post_comments(id uuid primary key,author_id uuid,body text,updated_at timestamptz default now(),parent_comment_id uuid references public.post_comments(id) on delete cascade);
 create function public.delete_post_comment(target_comment_id uuid) returns void language plpgsql as $$begin delete from public.post_comments where id=target_comment_id; end$$;
 select set_config('request.jwt.claim.sub','${a}',false);
 insert into public.post_comments(id,author_id,body) values('${a}','${a}','Remove my text');
 insert into public.post_comments(id,author_id,body,parent_comment_id) values('${b}','${b}','Keep my reply','${a}');`);
 const deletion=fs.readFileSync('supabase/migrations/20261113050000_preserve_comment_replies.sql','utf8');await db.exec(deletion);await db.exec(deletion);
 await assert.rejects(()=>db.query('select public.delete_post_comment($1)',[b]),error=>error.code==='42501');
 await db.query('select public.delete_post_comment($1)',[a]);
 assert.equal(await scalar('select author_id from public.post_comments where id=$1',[a]),null);
 assert.equal(await scalar('select body from public.post_comments where id=$1',[a]),'This comment was deleted.');
 assert.equal(await scalar('select body from public.post_comments where id=$1',[b]),'Keep my reply');
 await db.query('select public.delete_post_comment($1)',[a]);
 await db.exec('set role anon');await assert.rejects(()=>db.query('select public.delete_post_comment($1)',[b]));await db.exec('reset role');
 // Immediate dispatch uses asynchronous enqueueing, not a synchronous provider call.
 await db.exec(`truncate public.novori_push_outbox; create schema vault; create schema net;
 create table vault.decrypted_secrets(name text,decrypted_secret text);insert into vault.decrypted_secrets values('novori_phone_push_worker','TEST-ONLY-SECRET');
 create table public.test_push_wakes(id bigint generated always as identity);
 create table public.test_push_fault(enabled boolean);insert into public.test_push_fault values(false);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$begin
 if (select enabled from public.test_push_fault) then raise exception 'Network queue unavailable';end if;
 insert into public.test_push_wakes default values;return 1;end$$;
 alter table public.reading_reminder_preferences add column timezone text not null default 'UTC';
 create table public.reading_checkins(user_id uuid,local_date date);
 create function public.sync_reading_reminder_device(device_timezone text) returns jsonb language plpgsql as $$begin
 if auth.uid() is null then raise exception 'Sign in';end if;
 return (select to_jsonb(p) from public.reading_reminder_preferences p where user_id=auth.uid());end$$;
 create function public.get_year_in_reading_insights(reading_year integer,reader_timezone text) returns jsonb language sql as $$
 select jsonb_build_object('year',reading_year,'finishedBooks',case when auth.uid()='${a}'::uuid then 2 else 0 end,'daysRead',0)$$;
 select set_config('request.jwt.claim.sub','${a}',false);`);
 for(const file of ['20261113070000_anonymous_vote_push.sql','20261113080000_immediate_push.sql','20261113090000_yearly_recap_reminders.sql','20261113100000_push_reminder_eligibility.sql']){
  const migration=fs.readFileSync('supabase/migrations/'+file,'utf8');await db.exec(migration);await db.exec(migration);
 }
 await db.exec(`insert into public.notifications(recipient_id,type,title) values('${a}','comment','Someone commented on your post.');`);
 assert.equal(await scalar('select count(*)::int from public.test_push_wakes'),1,'new immediate alert must wake delivery');
 await db.exec(`insert into public.notifications(recipient_id,type,title) values('${a}','comment','Another comment');`);
 assert.equal(await scalar('select count(*)::int from public.test_push_wakes'),1,'a burst shares one wake');
 await db.exec(`update public.novori_push_wake_state set last_wake_at='-infinity';
 insert into public.notifications(recipient_id,actor_id,type,title,entity_type,entity_id,metadata)
 values('${a}','${b}','post_vote','Tristan upvoted your post','post','${a}','{"vote_value":1}');`);
 assert.equal(await scalar('select count(*)::int from public.test_push_wakes'),1,'delayed upvote batching must not wake early');
 const anonPostVote=await scalar("select id from public.notifications where type='post_vote' order by created_at desc limit 1");
 assert.equal(await scalar('select public.novori_push_preview($1)',[anonPostVote]),'Someone upvoted your post.');
 await db.exec(`update public.test_push_fault set enabled=true;insert into public.notifications(recipient_id,type,title) values('${a}','follow','Another follow');`);
 assert.equal(await scalar("select count(*)::int from public.novori_push_outbox where state='pending'")>0,true,'wake failure preserves the outbox and user action');
 await db.exec('update public.test_push_fault set enabled=false');
 // A check-in completed after reminder creation must suppress its phone delivery.
 await db.exec(`update public.reading_reminder_preferences set daily_checkin=true where user_id='${a}';
 insert into public.reading_checkins values('${a}',current_date);`);
 const checkedIn=await scalar(`insert into public.notifications(recipient_id,type,title,entity_type,metadata) values('${a}','system','Check in','reading_reminder','{"reading_reminder_kind":"daily_checkin"}') returning id`);
 assert.equal(await scalar('select public.novori_push_allowed($1)',[checkedIn]),false);
 // Annual reminders are local-time eligible, data-backed and independently deduplicated.
 await db.exec(`insert into public.reading_reminder_preferences(user_id,monthly_recap) values('${b}',true);`);
 assert.equal(await scalar("select public.novori_generate_yearly_recap_reminders('2027-01-01 17:59Z')"),0);
 assert.equal(await scalar("select public.novori_generate_yearly_recap_reminders('2027-01-01 18:00Z')"),1);
 assert.equal(await scalar("select public.novori_generate_yearly_recap_reminders('2027-01-01 18:01Z')"),0,'annual reminder must not repeat');
 const annual=await scalar("select metadata from public.notifications where metadata->>'reading_reminder_kind'='yearly_recap'");
 assert.equal(annual.reference_date,'2026-12-31');
 assert.equal(await scalar("select count(*)::int from public.novori_yearly_recap_deliveries where user_id='"+b+"' and notified"),0,'no activity means no annual alert');
 assert.equal(await scalar("select current_setting('request.jwt.claim.sub')"),a,'annual generator restores auth context');
 await db.exec(`update public.reading_reminder_preferences set yearly_recap=false where user_id='${a}'`);
 assert.equal(await scalar("select count(*)::int from public.notifications where recipient_id='"+a+"' and metadata->>'reading_reminder_kind'='yearly_recap'"),0,'annual opt-out clears pending reminder');
 assert.equal(await scalar("select public.novori_generate_yearly_recap_reminders('2028-01-01 18:00Z')"),0,'annual opt-out must be respected');

 await db.exec(`delete from public.novori_yearly_recap_deliveries where user_id='${a}' and reading_year=2026;
 update public.reading_reminder_preferences set yearly_recap=true,timezone='America/Chicago' where user_id='${a}';`);
 assert.equal(await scalar("select public.novori_generate_yearly_recap_reminders('2027-01-01 23:59Z')"),0,'6 PM is local, not UTC');
 assert.equal(await scalar("select public.novori_generate_yearly_recap_reminders('2027-01-02 00:00Z')"),1,'local January 1 can be January 2 UTC');
 await db.exec(`delete from public.notifications where recipient_id='${a}' and metadata->>'reading_reminder_kind'='yearly_recap'`);
 assert.equal(await scalar("select public.novori_generate_yearly_recap_reminders('2027-01-02 00:01Z')"),0,'clearing inbox must not resend annual recap');
 assert.equal(await scalar("select public.novori_generate_yearly_recap_reminders('2026-01-01 18:00Z')"),0,'do not backfill before yearly opt-in');
 await db.exec('set role authenticated');await assert.rejects(()=>db.query('select public.novori_generate_yearly_recap_reminders()'));await db.exec('reset role');
 // Shortening the vote delay also needs a due-batch wake, not just a timestamp.
 await db.exec(`truncate public.novori_push_outbox;update public.novori_push_wake_state set last_wake_at='-infinity';
 insert into public.notifications(recipient_id,type,title,entity_type,entity_id,metadata) values('${a}','post_vote','Anonymous vote','post','${a}','{"vote_value":1}');`);
 const shortVotes=fs.readFileSync('supabase/migrations/20261113110000_fast_vote_batches.sql','utf8');await db.exec(shortVotes);await db.exec(shortVotes);
 assert.equal(await scalar("select available_at<=created_at+interval '15 seconds' from public.novori_push_outbox"),true,'pending old batches must be shortened');
 await db.exec(`insert into public.notifications(recipient_id,type,title,entity_type,entity_id,metadata) values('${a}','comment_vote','Anonymous vote','comment','${b}','{"vote_value":1}');`);
 assert.equal(await scalar("select bool_and(available_at<=created_at+interval '15 seconds') from public.novori_push_outbox"),true,'new batches use 15 seconds');
 const wakes=await scalar('select count(*)::int from public.test_push_wakes');
 await db.exec('select public.novori_dispatch_due_vote_push()');
 assert.equal(await scalar('select count(*)::int from public.test_push_wakes'),wakes,'idle due checks must not invoke Edge');
 await db.exec("update public.novori_push_outbox set available_at=now()-interval '1 second';select public.novori_dispatch_due_vote_push();select public.novori_dispatch_due_vote_push();");
 assert.equal(await scalar('select count(*)::int from public.test_push_wakes'),wakes+1,'ready batches wake immediately and share a burst');
 const shortJobs=await scalar('select public.novori_claim_push()');assert.equal(shortJobs.length,2);assert.ok(shortJobs.every(j=>!j.body.includes('Tristan')));
 await db.exec('set role authenticated');await assert.rejects(()=>db.query('select public.novori_dispatch_due_vote_push()'));await db.exec('reset role');
 console.log('Phone push SQL checks passed: replay safety, RLS, preference/mute checks, account transfer, receipts, logout, self-test rate limit.');
 await db.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
