// Runs the separate reminder SQL in an isolated embedded PostgreSQL database.
// Test dependency only (the mobile app gains no dependencies):
// npm install --prefix /tmp/novori-reminder-check @electric-sql/pglite@0.5.8
// NOVORI_PGLITE_MODULE=/tmp/novori-reminder-check/node_modules/@electric-sql/pglite \
//   node scripts/verify-reading-reminders.cjs /path/to/40-reading-reminders.sql.txt [/path/to/41-reading-reminder-defaults.sql.txt] [/path/to/42-reading-reminder-fixed-time.sql.txt]
const { PGlite } = require(process.env.NOVORI_PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('fs');
const assert = require('node:assert/strict');
const sqlPath = process.argv[2];
const defaultsSqlPath = process.argv[3];
const fixedTimeSqlPath = process.argv[4];
if (!sqlPath) throw new Error('Pass the path to 40-reading-reminders.sql.txt. This verifier runs only in embedded PostgreSQL.');
const db = new PGlite();
let checks = 0;
async function expectQuery(sql, expected, message) {
  const { rows } = await db.query(sql);
  assert.equal(Object.values(rows[0])[0], expected, message); checks++;
}
const id = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const book = '00000000-0000-0000-0000-000000000003';
const journey = '00000000-0000-0000-0000-000000000004';
async function reset(prefs, timezone = 'UTC', time = '20:00') {
  await db.exec(`reset role; truncate public.reading_reminder_preferences, public.reading_reminder_deliveries, public.notifications,
    public.reading_checkins, public.reading_checkpoints, public.reading_notes, public.reading_sessions, public.user_books, public.posts;
    insert into public.user_books values ('${book}','${id}','reading');
    insert into public.reading_sessions values ('${journey}','${id}','${book}',1,'active','2026-08-01','2026-08-01','2026-08-01',null,null);
    alter table public.reading_reminder_preferences disable trigger novori_reading_reminder_preferences_guard;
    insert into public.reading_reminder_preferences(user_id,daily_checkin,still_reading,weekly_recap,monthly_recap,timezone,reminder_time)
      values ('${id}',false,false,false,false,'${timezone}','${time}');
    update public.reading_reminder_preferences set ${prefs}=true;
    update public.reading_reminder_preferences set enabled_since = '{"daily_checkin":"2026-08-01Z","still_reading":"2026-08-01Z","weekly_recap":"2026-08-01Z","monthly_recap":"2026-08-01Z"}';
    alter table public.reading_reminder_preferences enable trigger novori_reading_reminder_preferences_guard;`);
}
(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    insert into auth.users values ('${id}'),('${other}');
    create table public.notifications(id uuid primary key default gen_random_uuid(), recipient_id uuid references auth.users(id),
      type text check(type in ('system','follow')), title text,body text,entity_type text,metadata jsonb,read_at timestamptz,created_at timestamptz);
    create table public.user_books(id uuid, user_id uuid, status text);
    create table public.reading_sessions(id uuid,user_id uuid,user_book_id uuid,session_number int,journey_status text,
      started_at timestamptz,created_at timestamptz,updated_at timestamptz,finished_at timestamptz,dnf_at timestamptz);
    create table public.reading_checkins(user_id uuid,local_date date);
    create table public.reading_checkpoints(user_id uuid,created_at timestamptz);
    create table public.reading_notes(user_id uuid,created_at timestamptz);
    create table public.posts(author_id uuid,post_type text,created_at timestamptz);`);
  // The embedded Postgres engine does not load pg_cron. Only extension/job registration
  // and its diagnostic SELECT are omitted; application tables, triggers, grants, RLS,
  // and generator below are exactly the delivered SQL.
  let sql = fs.readFileSync(sqlPath,'utf8').replace(/create extension if not exists pg_cron;[\s\S]*?commit;/, 'commit;')
    .replace(/select jobname, schedule, active from cron.job where jobname = 'novori-reading-reminders';/, '');
  await db.exec(sql); await db.exec(sql); checks++;
  if (defaultsSqlPath) {
    const defaultsSql = fs.readFileSync(defaultsSqlPath,'utf8');
    await reset('weekly_recap','America/Chicago','21:15');
    await db.exec(defaultsSql); await db.exec(defaultsSql); checks++;
    await expectQuery('select daily_checkin from public.reading_reminder_preferences',false,'migration preserves opt-out');
    await expectQuery("select reminder_time::text from public.reading_reminder_preferences",'21:15:00','migration preserves custom time');
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${id}'`);
    await expectQuery("select public.sync_reading_reminder_device('America/Los_Angeles')->>'timezone'",'America/Los_Angeles','phone zone updated');
    await expectQuery('select daily_checkin from public.reading_reminder_preferences',false,'zone sync preserves opt-out');
    await expectQuery("select reminder_time::text from public.reading_reminder_preferences",'21:15:00','zone sync preserves custom time');
    await db.exec(`set request.jwt.claim.sub='${other}'`);
    await expectQuery("select public.sync_reading_reminder_device('America/Chicago')->>'reminder_time'",'18:00:00','new reader at 6 PM');
    await expectQuery('select daily_checkin and still_reading and weekly_recap and monthly_recap from public.reading_reminder_preferences',true,'all new reader defaults on');
    await expectQuery("select enabled_since ?& array['daily_checkin','still_reading','weekly_recap','monthly_recap'] from public.reading_reminder_preferences",true,'enable timestamps generated');
    await db.exec('update public.reading_reminder_preferences set daily_checkin=false');
    await db.query("select public.sync_reading_reminder_device('America/New_York')");
    await expectQuery('select daily_checkin from public.reading_reminder_preferences',false,'returning reader opt-out retained');
    await assert.rejects(db.query("select public.sync_reading_reminder_device('Invalid/Zone')"), /valid IANA/); checks++;
    await db.exec("set request.jwt.claim.sub=''");
    await assert.rejects(db.query("select public.sync_reading_reminder_device('UTC')"), /Sign in/); checks++;
    await db.exec('reset role');
  }
  await reset('daily_checkin');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 19:59Z')",0,'before chosen time');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 20:00Z')",1,'daily due');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 20:15Z')",0,'repeated cron');
  await db.exec('delete from public.notifications');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 21:00Z')",0,'inbox clear does not resend');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-04 20:00Z')",1,'next local day');
  await db.exec(`insert into public.reading_checkins values ('${id}','2026-10-04')`);
  await expectQuery('select count(*)::int from public.notifications',0,'check-in removes unread habit notification');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-04 21:00Z')",0,'already checked in');
  await reset('daily_checkin','UTC','23:59');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 23:58Z')",0,'late time not early');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 23:59Z')",1,'last minute of day supported');
  await reset('daily_checkin','America/Los_Angeles');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-04 02:59Z')",0,'local clock');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-04 03:00Z')",1,'local Oct 3 due');
  await expectQuery("select metadata->>'local_date' from public.notifications",'2026-10-03','local day is not UTC day');
  await reset('daily_checkin','America/New_York','01:30');
  await expectQuery("select public.novori_generate_reading_reminders('2026-11-01 06:30Z')",1,'fall DST');
  await expectQuery("select public.novori_generate_reading_reminders('2026-11-01 07:30Z')",0,'DST no double delivery');
  await reset('daily_checkin','America/New_York','02:30');
  await expectQuery("select public.novori_generate_reading_reminders('2027-03-14 07:30Z')",1,'spring missing hour');
  await reset('daily_checkin');
  await db.exec("update public.reading_sessions set journey_status = 'paused'");
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 20:00Z')",0,'paused journey');
  await db.exec("update public.user_books set status = 'read'");
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-04 20:00Z')",0,'finished book');
  await reset('still_reading');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 20:00Z')",1,'inactive nudge');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-04 20:00Z')",0,'weekly cap');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-10 20:00Z')",1,'seven days later');
  await reset('still_reading');
  await db.exec(`delete from public.reading_sessions; insert into public.reading_checkins values ('${id}','2026-08-10')`);
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 20:00Z')",0,'nudge requires an active journey');
  await reset('still_reading');
  await db.exec(`insert into public.reading_sessions values (gen_random_uuid(),'${id}','${book}',2,'paused','2026-09-01','2026-09-01','2026-09-01',null,null)`);
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 20:00Z')",0,'older active journey cannot override latest paused journey');
  await reset('still_reading');
  await db.exec(`alter table public.reading_reminder_preferences disable trigger novori_reading_reminder_preferences_guard;
    update public.reading_reminder_preferences set daily_checkin=true;
    alter table public.reading_reminder_preferences enable trigger novori_reading_reminder_preferences_guard;`);
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 20:00Z')",1,'habit reminders share a daily cap');
  await expectQuery("select metadata->>'reading_reminder_kind' from public.notifications",'still_reading','inactivity nudge takes priority');
  await reset('still_reading');
  await db.exec(`insert into public.reading_notes values ('${id}','2026-10-02Z')`);
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 20:00Z')",0,'recent note activity');
  await reset('weekly_recap');
  await db.exec(`insert into public.reading_checkins values ('${id}','2026-09-30')`);
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-05 20:00Z')",1,'Monday recap');
  await expectQuery("select metadata->>'reference_date' from public.notifications",'2026-10-04','previous completed week');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-05 21:00Z')",0,'recap dedup');
  await reset('monthly_recap');
  await db.exec(`insert into public.reading_checkins values ('${other}','2026-09-30')`);
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-01 20:00Z')",0,'no activity from another reader');
  await db.exec(`insert into public.posts values ('${id}','reading_update','2026-09-30Z')`);
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-01 20:00Z')",1,'monthly reading post activity');
  await expectQuery("select metadata->>'reference_date' from public.notifications",'2026-09-30','previous completed month');
  await reset('weekly_recap');
  await db.exec(`insert into public.reading_checkins values ('${id}','2027-01-30');
    alter table public.reading_reminder_preferences disable trigger novori_reading_reminder_preferences_guard;
    update public.reading_reminder_preferences set monthly_recap=true,daily_checkin=true;
    alter table public.reading_reminder_preferences enable trigger novori_reading_reminder_preferences_guard;`);
  await expectQuery("select public.novori_generate_reading_reminders('2027-02-01 20:00Z')",2,'both recaps available on first-of-month Monday, habits suppressed');
  await expectQuery("select public.novori_generate_reading_reminders('2027-02-01 21:00Z')",0,'combined recaps deduplicated');
  await reset('daily_checkin');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-03 20:00Z')",1,'before opt-out');
  await db.exec('update public.reading_reminder_preferences set daily_checkin = false');
  await expectQuery('select count(*)::int from public.notifications',0,'opt-out removes pending reminder');
  await expectQuery("select public.novori_generate_reading_reminders('2026-10-04 20:00Z')",0,'opt-out delivery');
  await db.exec('update public.reading_reminder_preferences set daily_checkin = true');
  await expectQuery("select public.novori_generate_reading_reminders('2026-08-03 20:00Z')",0,'no backfill before opt-in');
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${other}'`);
  await expectQuery('select count(*)::int from public.reading_reminder_preferences',0,'RLS hides other reader preferences');
  for (const statement of ["select public.novori_generate_reading_reminders()",'select * from public.reading_reminder_deliveries',
    `insert into public.reading_reminder_preferences(user_id,enabled_since) values ('${other}','{}')`]) {
    await assert.rejects(db.query(statement), /permission denied/); checks++;
  }
  await db.exec(`insert into public.reading_reminder_preferences(user_id,daily_checkin) values ('${other}',true)
    on conflict(user_id) do update set user_id=excluded.user_id,daily_checkin=excluded.daily_checkin`);
  await expectQuery('select count(*)::int from public.reading_reminder_preferences',1,'own upsert allowed');
  await assert.rejects(db.query(`update public.reading_reminder_preferences set user_id='${id}' where user_id='${other}'`), /row-level security/); checks++;
  await assert.rejects(db.query("update public.reading_reminder_preferences set timezone='Bad/Timezone'"), /valid IANA/); checks++;
  if (fixedTimeSqlPath) {
    if (!defaultsSqlPath) throw new Error('Pass the defaults SQL before the fixed-time SQL.');
    await reset('weekly_recap','America/Chicago','21:15');
    const fixedSql = fs.readFileSync(fixedTimeSqlPath,'utf8');
    await db.exec(fixedSql); await db.exec(fixedSql); checks++;
    await expectQuery("select reminder_time::text from public.reading_reminder_preferences",'18:00:00','custom time reset to 6 PM');
    await expectQuery('select daily_checkin from public.reading_reminder_preferences',false,'fixed time keeps opt-out');
    await expectQuery('select weekly_recap from public.reading_reminder_preferences',true,'fixed time keeps enabled recap');
    await expectQuery("select enabled_since->>'weekly_recap' from public.reading_reminder_preferences",'2026-08-01Z','fixed time keeps original activation');
    await expectQuery("select timezone from public.reading_reminder_preferences",'America/Chicago','fixed time keeps phone zone');
    await assert.rejects(db.query("update public.reading_reminder_preferences set reminder_time='21:15'"), /check constraint/); checks++;
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${id}'`);
    await assert.rejects(db.query("update public.reading_reminder_preferences set reminder_time='21:15'"), /permission denied/); checks++;
    await expectQuery("select public.sync_reading_reminder_device('America/Los_Angeles')->>'reminder_time'",'18:00:00','zone sync retains fixed hour');
    await db.exec(`insert into public.reading_reminder_preferences(user_id,daily_checkin,timezone)
      values ('${id}',true,'America/Los_Angeles') on conflict(user_id)
      do update set user_id=excluded.user_id,daily_checkin=excluded.daily_checkin,timezone=excluded.timezone`);
    await expectQuery('select daily_checkin from public.reading_reminder_preferences',true,'toggle upsert still allowed');
    await db.exec('reset role');
    await expectQuery("select public.novori_generate_reading_reminders('2026-10-04 00:59Z')",0,'no reminder before local 6 PM');
    await expectQuery("select public.novori_generate_reading_reminders('2026-10-04 01:00Z')",1,'reminder due at local 6 PM');
    await expectQuery("select metadata->>'local_date' from public.notifications",'2026-10-03','fixed hour uses phone local day');
  }
  console.log(`PASS: ${checks} PostgreSQL reminder checks (Cron installation excluded).`);
  await db.close();
})().catch(async error => { console.error(error); await db.close(); process.exitCode=1; });
