// Isolated PostgreSQL verification; no live database connection or mobile dependency.
// npm install --prefix /tmp/novori-goal-check @electric-sql/pglite@0.5.8
// NOVORI_PGLITE_MODULE=/tmp/novori-goal-check/node_modules/@electric-sql/pglite \
//   node scripts/verify-reading-goals.cjs /path/to/43-reading-goals.sql.txt
const { PGlite } = require(process.env.NOVORI_PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('fs');
const assert = require('node:assert/strict');
const sqlPath = process.argv[2];
if (!sqlPath) throw new Error('Pass the separate reading goals SQL path.');
const db = new PGlite();
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
let checks = 0;
async function check(sql, expected, message) {
  const { rows } = await db.query(sql);
  assert.equal(Object.values(rows[0])[0], expected, message); checks++;
}
const progress = (year='2025', month='2025-10-01', zone='America/Chicago') =>
  `public.get_reading_goal_progress('${year}-01-01','${month}','${zone}')`;
async function reject(sql, pattern) { await assert.rejects(db.query(sql),pattern); checks++; }

(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    insert into auth.users values ('${id(1)}'),('${id(2)}');
    create table public.user_books(id uuid primary key,user_id uuid,status text,finished_at timestamptz,dnf_at timestamptz);
    create table public.reading_sessions(id uuid primary key,user_id uuid,user_book_id uuid references public.user_books(id),journey_status text,finished_at timestamptz,dnf_at timestamptz);
    alter table public.user_books enable row level security;
    alter table public.reading_sessions enable row level security;
    create policy books_own on public.user_books for select to authenticated using(user_id=auth.uid());
    create policy sessions_own on public.reading_sessions for select to authenticated using(user_id=auth.uid());
    grant select on public.user_books,public.reading_sessions to authenticated;`);
  const sql = fs.readFileSync(sqlPath,'utf8');
  await db.exec(sql); await db.exec(sql); checks++;

  for (let n=10;n<=27;n++) await db.exec(`insert into public.user_books values ('${id(n)}','${id(1)}','reading',null,null)`);
  await db.exec(`update public.user_books set status='read',finished_at='2025-10-11Z' where id='${id(11)}';
    update public.user_books set status='read',finished_at='2025-10-12Z' where id='${id(12)}';
    update public.user_books set status='read' where id='${id(13)}';
    update public.user_books set status='dnf',finished_at='2025-10-14Z',dnf_at='2025-10-14Z' where id='${id(14)}';
    update public.user_books set status='read',finished_at='2024-02-29 06:00Z' where id='${id(24)}';
    insert into public.user_books values ('${id(30)}','${id(2)}','read','2025-10-02Z',null);`);
  const sessions = [
    [100,10,'finished','2025-01-10Z',null], [101,10,'finished','2025-10-10Z',null],
    [102,11,'finished','2025-10-11Z',null], [103,15,'paused','2025-10-15Z',null],
    [104,16,'active','2025-10-16Z',null], [105,17,'finished','2099-10-10Z',null],
    [106,18,'finished','2025-01-01 05:59Z',null], [107,19,'finished','2025-01-01 06:00Z',null],
    [108,20,'finished','2025-11-01 04:59Z',null], [109,21,'finished','2025-11-01 05:00Z',null],
    [110,22,'finished','2025-10-01 04:59Z',null], [111,23,'finished','2025-10-01 05:00Z',null],
    [112,25,'finished','2025-03-09 07:59Z',null], [113,26,'finished','2025-03-09 08:00Z',null],
    [114,27,'finished','2025-10-05Z','2025-10-06Z'],
  ];
  for(const [n,b,status,finished,dnf] of sessions) {
    await db.exec(`insert into public.reading_sessions values ('${id(n)}','${id(1)}','${id(b)}','${status}','${finished}',${dnf ? `'${dnf}'` : 'null'})`);
  }
  await db.exec(`insert into public.reading_sessions values ('${id(200)}','${id(2)}','${id(30)}','finished','2025-10-02Z',null);
    set role authenticated; set request.jwt.claim.sub='${id(1)}'`);

  await check(`select (${progress()}->'annual'->>'finishedBooks')::int`,11,'annual counts histories, rereads, dated legacy once');
  await check(`select (${progress()}->'monthly'->>'finishedBooks')::int`,5,'monthly completion boundaries');
  await check(`select ${progress()}->'annual'->>'targetBooks'`,null,'unset target does not invent a goal');
  await check(`select (${progress('2024','2024-02-01')}->'annual'->>'finishedBooks')::int`,2,'prior year boundary and leap legacy');
  await check(`select (${progress('2024','2024-02-01')}->'monthly'->>'finishedBooks')::int`,1,'leap-day completion');
  await check(`select (${progress('2025','2025-03-01')}->'monthly'->>'finishedBooks')::int`,2,'DST date boundaries');
  await check(`select (${progress('2025','2025-11-01')}->'monthly'->>'finishedBooks')::int`,1,'local month boundary');
  await check(`select (${progress('2025','2025-11-01','UTC')}->'monthly'->>'finishedBooks')::int`,2,'phone timezone changes period membership');
  await check(`select (${progress('2025','2025-10-01','UTC')}->'annual'->>'finishedBooks')::int`,12,'UTC year has different boundary');
  await check(`select (${progress('2099','2099-10-01')}->'annual'->>'finishedBooks')::int`,0,'future-dated completions do not count early');
  await check(`select (${progress('2026','2025-10-01')}->'monthly'->>'finishedBooks')::int`,5,'annual and monthly references can be independent');

  await db.exec(`insert into public.reading_goals(user_id,goal_kind,period_start,target_books) values
    ('${id(1)}','annual','2025-01-01',24),('${id(1)}','monthly','2025-10-01',3),('${id(1)}','monthly','2025-11-01',4)`);
  await check(`select (${progress()}->'annual'->>'targetBooks')::int`,24,'annual target read');
  await check(`select (${progress()}->'monthly'->>'targetBooks')::int`,3,'monthly target read');
  await check(`select (${progress('2025','2025-11-01')}->'monthly'->>'targetBooks')::int`,4,'separate month target');
  await check(`select ${progress('2026','2026-10-01')}->'annual'->>'targetBooks'`,null,'new calendar year has a separate target');
  await check(`select ${progress('2025','2025-12-01')}->'monthly'->>'targetBooks'`,null,'new calendar month has a separate target');
  await db.exec(`insert into public.reading_goals(user_id,goal_kind,period_start,target_books) values('${id(1)}','annual','2025-01-01',10)
    on conflict(user_id,goal_kind,period_start) do update set user_id=excluded.user_id,goal_kind=excluded.goal_kind,period_start=excluded.period_start,target_books=excluded.target_books`);
  await check(`select (${progress()}->'annual'->>'targetBooks')::int`,10,'editing target replaces same goal');
  await check(`select (${progress()}->'annual'->>'finishedBooks')::int`,11,'editing target never resets progress');
  await check('select count(*)::int from public.reading_goals',3,'upsert never duplicates a goal');
  await db.exec("delete from public.reading_goals where goal_kind='monthly' and period_start='2025-10-01'");
  await check(`select ${progress()}->'monthly'->>'targetBooks'`,null,'removed target is unset');
  await check(`select (${progress()}->'monthly'->>'finishedBooks')::int`,5,'removing target preserves completed books');
  await check(`select (${progress()}->'annual'->>'targetBooks')::int`,10,'monthly removal keeps annual target');
  for (const target of [0,-1,10001]) await reject(`insert into public.reading_goals(user_id,goal_kind,period_start,target_books) values('${id(1)}','annual','2026-01-01',${target})`,/check constraint/);
  for (const [kind,period] of [['annual','2026-02-01'],['monthly','2026-10-02'],['monthly','1969-12-01'],['weekly','2026-01-01']]) {
    await reject(`insert into public.reading_goals(user_id,goal_kind,period_start,target_books) values('${id(1)}','${kind}','${period}',3)`,/check constraint/);
  }
  await reject(`select public.get_reading_goal_progress('2026-02-01','2026-10-01','UTC')`,/calendar/);
  await reject(`select public.get_reading_goal_progress('2026-01-01','2026-10-02','UTC')`,/calendar/);
  await reject(`select public.get_reading_goal_progress('2026-01-01','2026-10-01','Invalid/Zone')`,/IANA/);
  await reject(`insert into public.reading_goals(user_id,goal_kind,period_start,target_books) values('${id(2)}','annual','2026-01-01',10)`,/row-level security/);
  await reject(`update public.reading_goals set user_id='${id(2)}' where goal_kind='annual'`,/row-level security/);
  await reject("update public.reading_goals set updated_at='1900-01-01'",/permission denied/);

  await db.exec(`set request.jwt.claim.sub='${id(2)}'`);
  await check('select count(*)::int from public.reading_goals',0,'another reader cannot see targets');
  await check(`select (${progress()}->'annual'->>'finishedBooks')::int`,1,'another reader sees only own completed journey');
  await check(`select ${progress()}->'annual'->>'targetBooks'`,null,'another reader cannot read goal through RPC');
  await db.exec(`delete from public.reading_goals where user_id='${id(1)}'; update public.reading_goals set target_books=1 where user_id='${id(1)}';
    set request.jwt.claim.sub='${id(1)}'`);
  await check(`select (${progress()}->'annual'->>'targetBooks')::int`,10,'other reader cannot delete or edit target');
  await db.exec('reset role');
  await db.exec(`update public.reading_sessions set finished_at='2025-09-10Z' where id='${id(101)}';
    set role authenticated; set request.jwt.claim.sub='${id(1)}'`);
  await check(`select (${progress()}->'monthly'->>'finishedBooks')::int`,4,'corrected finish date updates progress automatically');
  await check(`select (${progress('2025','2025-09-01')}->'monthly'->>'finishedBooks')::int`,2,'corrected finish joins its actual month');
  await db.exec("set request.jwt.claim.sub=''");
  await reject(`select ${progress()}`,/Sign in/);
  await db.exec('reset role; set role anon');
  await reject('select * from public.reading_goals',/permission denied/);
  await reject(`select ${progress()}`,/permission denied/);
  console.log(`PASS: ${checks} PostgreSQL goal checks.`);
  await db.close();
})().catch(async error => { console.error(error); await db.close(); process.exitCode=1; });
