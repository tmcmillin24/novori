import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const db = new PGlite();
let request = 1000;
async function scalar(sql, args = []) {
  return (await db.query(sql, args)).rows[0];
}
async function act(
  action,
  type,
  target,
  reason = "Documented policy violation",
  expected = null,
  payload = {},
  actor = id(1),
  req = id(++request),
) {
  return scalar(
    "select public.novori_admin_apply_action($1,$2,$3,$4,$5,$6,$7,$8) result",
    [
      actor,
      req,
      action,
      type,
      target,
      reason,
      expected,
      JSON.stringify(payload),
    ],
  );
}
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key,email text);
create table public.profiles(id uuid primary key references auth.users(id),username text,display_name text,bio text,avatar_url text,created_at timestamptz default now());
create table public.clubs(id uuid primary key,owner_id uuid,name text,description text,rules text,privacy text default 'public',created_at timestamptz default now(),updated_at timestamptz default now());
create table public.club_members(club_id uuid,user_id uuid,role text,joined_at timestamptz default now());
create table public.posts(id uuid primary key,author_id uuid,club_id uuid,body text,post_type text,post_image_url text,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.post_comments(id uuid primary key,post_id uuid references public.posts(id) on delete cascade,parent_comment_id uuid references public.post_comments(id),author_id uuid,body text,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.content_reports(id uuid primary key,reporter_id uuid,target_type text,target_id uuid,reason text,status text default 'pending',created_at timestamptz default now(),updated_at timestamptz default now());
create table public.notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid,type text,title text,body text,created_at timestamptz default now());
create table public.account_deletion_requests(user_id uuid primary key);
create function public.novori_account_active(reader_id uuid) returns boolean language sql stable security definer as $$select reader_id is not null and exists(select 1 from auth.users where id=reader_id) and not exists(select 1 from public.account_deletion_requests where user_id=reader_id)$$;
alter table public.profiles enable row level security;alter table public.posts enable row level security;alter table public.post_comments enable row level security;alter table public.club_members enable row level security;
create policy novori_active_account on public.profiles as restrictive to authenticated using(public.novori_account_active(auth.uid())) with check(public.novori_account_active(auth.uid()));
create policy novori_active_account on public.posts as restrictive to authenticated using(public.novori_account_active(auth.uid())) with check(public.novori_account_active(auth.uid()));
create policy novori_active_account on public.post_comments as restrictive to authenticated using(public.novori_account_active(auth.uid())) with check(public.novori_account_active(auth.uid()));
create policy novori_active_account on public.club_members as restrictive to authenticated using(public.novori_account_active(auth.uid())) with check(public.novori_account_active(auth.uid()));
create policy base on public.posts to authenticated using(true) with check(true);
grant usage on schema auth,public to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;
grant select,insert,update,delete on all tables in schema public to authenticated,service_role;`);
await db.exec(
  await readFile(
    new URL(
      "../../supabase/migrations/20261005012000_novori_admin_hub.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
for (let i = 1; i <= 6; i++) {
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    id(i),
    `reader${i}@example.test`,
  ]);
  await db.query("insert into public.profiles(id,username) values($1,$2)", [
    id(i),
    `reader${i}`,
  ]);
}
await db.query(
  "insert into public.novori_admin_members(user_id,role) values($1,'owner'),($2,'moderator'),($3,'support')",
  [id(1), id(2), id(3)],
);
await db.query(
  "insert into public.clubs(id,owner_id,name) values($1,$2,'Readers')",
  [id(10), id(4)],
);
await db.query(
  "insert into public.posts(id,author_id,club_id,body) values($1,$2,$3,'A public post')",
  [id(11), id(4), id(10)],
);
await db.query(
  "insert into public.post_comments(id,post_id,author_id,body) values($1,$2,$3,'Original comment')",
  [id(12), id(11), id(4)],
);
await db.query(
  "insert into public.post_comments(id,post_id,parent_comment_id,author_id,body) values($1,$2,$3,$4,'A preserved reply')",
  [id(13), id(11), id(12), id(5)],
);
await db.query(
  "insert into public.content_reports(id,reporter_id,target_type,target_id,reason) values($1,$2,'comment',$3,'harassment')",
  [id(14), id(5), id(12)],
);

test("migration applies and reruns without replacing the deletion foundation", async () => {
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261005012000_novori_admin_hub.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(
    (await scalar("select novori_account_active($1) active", [id(4)])).active,
    true,
  );
});
test("ordinary authenticated accounts cannot read admin tables or execute admin actions", async () => {
  await db.exec("set role authenticated");
  try {
    await assert.rejects(
      db.query("select * from novori_admin_members"),
      /permission denied/,
    );
    await assert.rejects(
      act("ban_reader", "reader", id(4)),
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
});
test("non-admin, support, and moderator owner-only actions are denied", async () => {
  await assert.rejects(
    act("warn_reader", "reader", id(4), "Documented decision", null, {}, id(6)),
    /Administrator access/,
  );
  await assert.rejects(
    act("warn_reader", "reader", id(4), "Documented decision", null, {}, id(3)),
    /read-only/,
  );
  await assert.rejects(
    act(
      "pause_club",
      "club",
      id(10),
      "Documented decision",
      new Date().toISOString(),
      {},
      id(2),
    ),
    /Owner access/,
  );
});
test("self/admin targets and null reasons fail closed", async () => {
  await assert.rejects(
    act("ban_reader", "reader", id(1)),
    /cannot be targeted/,
  );
  await assert.rejects(
    act("warn_reader", "reader", id(4), null),
    /decision reason/,
  );
});
test("stale report revisions are rejected without an audit or content change", async () => {
  await assert.rejects(
    act(
      "remove_content",
      "report",
      id(14),
      "Documented decision",
      "2000-01-01T00:00:00Z",
    ),
    /Report changed/,
  );
  assert.equal(
    (await scalar("select body from post_comments where id=$1", [id(12)])).body,
    "Original comment",
  );
});
test("removing a reported comment preserves descendants; retry is idempotent", async () => {
  const expected = (
    await scalar("select updated_at from content_reports where id=$1", [id(14)])
  ).updated_at;
  const req = id(++request);
  await act(
    "remove_content",
    "report",
    id(14),
    "Removed harassment",
    expected,
    {},
    id(2),
    req,
  );
  await act(
    "remove_content",
    "report",
    id(14),
    "Removed harassment",
    expected,
    {},
    id(2),
    req,
  );
  const c = await scalar(
    "select author_id,body from post_comments where id=$1",
    [id(12)],
  );
  assert.equal(c.author_id, null);
  assert.equal(c.body, "This comment was deleted.");
  assert.equal(
    (await scalar("select body from post_comments where id=$1", [id(13)])).body,
    "A preserved reply",
  );
  assert.equal(
    (
      await scalar(
        "select count(*)::int n from novori_admin_audit where request_id=$1",
        [req],
      )
    ).n,
    1,
  );
  await assert.rejects(
    act(
      "dismiss_report",
      "report",
      id(14),
      "Removed harassment",
      expected,
      {},
      id(2),
      req,
    ),
    /already used/,
  );
});
test("paused clubs block posting but permit membership changes", async () => {
  const expected = (
    await scalar("select updated_at from clubs where id=$1", [id(10)])
  ).updated_at;
  await act("pause_club", "club", id(10), "Pause pending review", expected);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id(4),
  ]);
  try {
    await assert.rejects(
      db.query("update posts set body=$1 where id=$2", ["Edited", id(11)]),
      /Posting in this club is paused/,
    );
    await db.query(
      "insert into club_members(club_id,user_id,role) values($1,$2,'member')",
      [id(10), id(4)],
    );
  } finally {
    await db.exec("select set_config('request.jwt.claim.sub','',false)");
  }
});
test("a suspension stops writes from an existing JWT and queues Auth synchronization", async () => {
  await act("suspend_reader", "reader", id(4), "Repeated harassment", null, {
    hours: 24,
  });
  assert.equal(
    (await scalar("select novori_reader_restricted($1) blocked", [id(4)]))
      .blocked,
    true,
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id(4),
  ]);
  try {
    await assert.rejects(
      db.query("update posts set body=$1 where id=$2", ["Edited", id(11)]),
      /account is restricted/,
    );
  } finally {
    await db.exec("select set_config('request.jwt.claim.sub','',false)");
  }
  const j = (await scalar("select novori_admin_claim_auth_job() job")).job;
  assert.equal(j.user_id, id(4));
  await db.query("select novori_admin_finish_auth_job($1,$2,false)", [
    j.id,
    j.claim_token,
  ]);
  assert.equal(
    (
      await scalar("select status from novori_admin_auth_jobs where id=$1", [
        j.id,
      ])
    ).status,
    "pending",
  );
});
test("a stale restore completion cannot clear a newer ban", async () => {
  await act("restore_reader", "reader", id(4), "Appeal approved");
  const stale = (await scalar("select novori_admin_claim_auth_job() job")).job;
  assert.equal(stale.superseded, true);
  const restore = (await scalar("select novori_admin_claim_auth_job() job"))
    .job;
  await act("ban_reader", "reader", id(4), "New severe violation");
  assert.equal(
    (await scalar("select novori_admin_claim_auth_job() job")).job,
    null,
  );
  await db.query("select novori_admin_finish_auth_job($1,$2,true)", [
    restore.id,
    restore.claim_token,
  ]);
  assert.equal(
    (await scalar("select novori_reader_restricted($1) blocked", [id(4)]))
      .blocked,
    true,
  );
  const ban = (await scalar("select novori_admin_claim_auth_job() job")).job;
  assert.equal(ban.permanent, true);
  await db.query("select novori_admin_finish_auth_job($1,$2,true)", [
    ban.id,
    ban.claim_token,
  ]);
});
test("profile masking remains possible during account deletion", async () => {
  await db.query("insert into account_deletion_requests(user_id) values($1)", [
    id(6),
  ]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id(6),
  ]);
  try {
    await db.query(
      "update profiles set display_name='Unavailable reader',username=null where id=$1",
      [id(6)],
    );
  } finally {
    await db.exec("select set_config('request.jwt.claim.sub','',false)");
  }
  assert.equal(
    (await scalar("select display_name from profiles where id=$1", [id(6)]))
      .display_name,
    "Unavailable reader",
  );
});
test("published announcements deliver once to active unrestricted readers only", async () => {
  await act(
    "save_announcement",
    "announcement",
    id(20),
    "Community update draft",
    null,
    { title: "A community update", body: "Welcome to Novori." },
  );
  const expected = (
    await scalar(
      "select updated_at from novori_admin_announcements where id=$1",
      [id(20)],
    )
  ).updated_at;
  await act(
    "publish_announcement",
    "announcement",
    id(20),
    "Approved community update",
    expected,
  );
  assert.equal(
    (await scalar("select novori_admin_deliver_announcement($1) n", [id(20)]))
      .n,
    4,
  );
  assert.equal(
    (await scalar("select novori_admin_deliver_announcement($1) n", [id(20)]))
      .n,
    0,
  );
  assert.equal(
    (
      await scalar(
        "select count(*)::int n from notifications where title='A community update'",
      )
    ).n,
    4,
  );
});
test("report alerts are queued only for enabled opted-in admins and have lease tokens", async () => {
  assert.equal(
    (await scalar("select count(*)::int n from novori_admin_report_alerts")).n,
    3,
  );
  const a = (await scalar("select novori_admin_claim_alert() alert")).alert;
  await assert.rejects(
    db.query("select novori_admin_finish_alert($1,$2,true)", [a.id, id(999)]),
    /lease changed/,
  );
  await db.query("select novori_admin_finish_alert($1,$2,true)", [
    a.id,
    a.claim_token,
  ]);
  assert.equal(
    (
      await scalar(
        "select status from novori_admin_report_alerts where id=$1",
        [a.id],
      )
    ).status,
    "sent",
  );
});
test("close database", async () => {
  await db.close();
});
