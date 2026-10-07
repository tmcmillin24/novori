import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authorizeAdmin,
  createAdminHandler,
  dispatchAdmin,
  runAdminJobs,
  validateId,
  summarizeApiUsage,
} from "../../supabase/functions/_shared/admin-hub.mjs";
const id = "10000000-0000-4000-8000-000000000001",
  target = "10000000-0000-4000-8000-000000000002";
const token = (aal) =>
  `header.${Buffer.from(JSON.stringify({ aal })).toString("base64url")}.signature`;
function fake({
  enabled = true,
  role = "owner",
  restricted = false,
  active = true,
  authError = false,
} = {}) {
  return {
    auth: {
      getUser: async () => ({
        error: authError ? { message: "PRIVATE_SECRET" } : null,
        data: { user: authError ? null : { id, email: "admin@example.test" } },
      }),
    },
    from: () => ({
      select: () => ({
        limit: async () => ({ data: [] }),
        eq: () => ({
          maybeSingle: async () => ({
            data: { user_id: id, role, enabled, email_alerts: true },
          }),
        }),
      }),
    }),
    rpc: async (name, args) => {
      if (name === "novori_account_active") {
        assert.equal(args.reader_id, id);
        return { data: active };
      }
      if (name === "novori_reader_restricted") return { data: restricted };
      throw new Error("PRIVATE_SECRET");
    },
  };
}
function request(action, headers = {}) {
  return new Request("https://backend.test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token("aal2")}`,
      Origin: "https://admin.novori.link",
      ...headers,
    },
    body: JSON.stringify({ action }),
  });
}
const handler = (c) =>
  createAdminHandler({
    client: c,
    allowedOrigins: ["https://admin.novori.link"],
    requireMfa: true,
  });
test("validates UUIDs before forming database filters", () => {
  assert.equal(validateId(id), id);
  assert.throws(() => validateId("or=(true)"), /valid item ID/);
});
test("unauthenticated, non-admin, inactive and restricted accounts are rejected", async () => {
  await assert.rejects(authorizeAdmin(fake(), ""), /Sign in/);
  await assert.rejects(
    authorizeAdmin(fake({ authError: true }), token("aal2")),
    /expired/,
  );
  await assert.rejects(
    authorizeAdmin(fake({ enabled: false }), token("aal2")),
    /no Novori admin/,
  );
  await assert.rejects(
    authorizeAdmin(fake({ active: false }), token("aal2")),
    /unavailable/,
  );
  await assert.rejects(
    authorizeAdmin(fake({ restricted: true }), token("aal2")),
    /restricted/,
  );
});
test("MFA enrollment exposes only session; data and actions require aal2", async () => {
  const h = handler(fake());
  assert.equal(
    (await h(request("session", { Authorization: `Bearer ${token("aal1")}` })))
      .status,
    200,
  );
  assert.equal(
    (await h(request("reports", { Authorization: `Bearer ${token("aal1")}` })))
      .status,
    403,
  );
  assert.equal(
    (
      await h(
        request("ban_reader", { Authorization: `Bearer ${token("aal1")}` }),
      )
    ).status,
    403,
  );
  await assert.rejects(authorizeAdmin(fake(), "not-a-jwt"), /authenticator/);
});
test("only exact allowed origins receive CORS permission", async () => {
  const h = handler(fake());
  const res = await h(request("session"));
  assert.equal(
    res.headers.get("Access-Control-Allow-Origin"),
    "https://admin.novori.link",
  );
  const rejected = await h(
    request("session", { Origin: "https://admin.novori.link.attacker.test" }),
  );
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
});
test("HTTP methods, malformed payload and oversized requests are rejected", async () => {
  const h = handler(fake());
  assert.equal((await h(new Request("https://backend.test"))).status, 405);
  assert.equal(
    (
      await h(
        new Request("https://backend.test", {
          method: "POST",
          body: "not-json",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await h(
        new Request("https://backend.test", { method: "POST", body: "[]" }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await h(
        new Request("https://backend.test", {
          method: "POST",
          headers: { "content-length": "20000" },
          body: "{}",
        }),
      )
    ).status,
    413,
  );
});
test("service errors never expose internal details", async () => {
  const res = await handler(fake())(request("overview"));
  assert.equal(res.status, 503);
  assert.doesNotMatch(await res.text(), /PRIVATE_SECRET/);
});
test("worker secrets fail closed and do not accept prefix matches", async () => {
  const h = createAdminHandler({
    client: fake(),
    allowedOrigins: [],
    workerSecret: "a".repeat(64),
  });
  for (const value of ["a".repeat(63), "a".repeat(65), "b".repeat(64)])
    assert.equal(
      (
        await h(
          new Request("https://backend.test", {
            method: "POST",
            headers: { "x-admin-worker-secret": value },
            body: "{}",
          }),
        )
      ).status,
      401,
    );
});
test("support cannot mutate and moderator cannot access owner-only actions", async () => {
  await assert.rejects(
    dispatchAdmin(
      fake(),
      { user: { id }, member: { role: "support" } },
      { action: "ban_reader" },
    ),
    /not allowed/,
  );
  await assert.rejects(
    dispatchAdmin(
      fake(),
      { user: { id }, member: { role: "moderator" } },
      { action: "publish_announcement" },
    ),
    /not allowed/,
  );
});
test("committed decisions remain successful when background processing is unavailable", async () => {
  const c = fake();
  c.rpc = async (name) => {
    if (name === "novori_admin_apply_action")
      return { data: { completed: true, auth_sync_pending: true } };
    throw new Error("worker unavailable");
  };
  const r = await dispatchAdmin(
    c,
    { user: { id }, member: { role: "owner" } },
    {
      action: "ban_reader",
      target_id: target,
      request_id: id,
      target_type: "reader",
      reason: "Policy violation",
    },
  );
  assert.equal(r.completed, true);
  assert.equal(r.jobs_pending, true);
});
test("failed Auth synchronization finishes the lease as retryable", async () => {
  const calls = [];
  const c = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === "novori_admin_claim_auth_job")
        return {
          data: { id, claim_token: target, user_id: target, permanent: true },
        };
      return { data: null };
    },
    auth: {
      admin: {
        updateUserById: async () => ({ error: { message: "network" } }),
      },
    },
    from: () => ({
      select: () => ({
        limit: async () => ({ data: [] }),
        eq: () => ({
          eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }),
        }),
      }),
    }),
  };
  const r = await runAdminJobs(c);
  assert.equal(r.failed, 1);
  assert.equal(
    calls.find(([n]) => n === "novori_admin_finish_auth_job")[1].p_success,
    false,
  );
});

test("usage totals use exact UTC calendar boundaries and include empty providers", () => {
  const now = new Date("2026-10-05T02:00:00Z");
  const rows = [
    ["2026-10-05", 2],
    ["2026-10-04", 3],
    ["2026-09-29", 5],
    ["2026-09-28", 7],
    ["2026-09-06", 11],
    ["2026-09-05", 13],
    ["2026-10-06", 17],
  ].map(([usage_date, upstream_requests]) => ({
    provider: "google_books",
    usage_date,
    upstream_requests,
  }));
  const summary = summarizeApiUsage(rows, now);
  assert.deepEqual(summary.google_books, { today: 2, days7: 10, days30: 28 });
  assert.deepEqual(summary.hardcover, { today: 0, days7: 0, days30: 0 });
});
test("usage reads existing Google counts and the new Hardcover tracker separately", async () => {
  const client = {
    from: (table) => {
      const q = {
        select: () => q,
        gte: () => q,
        lte: () => q,
        order: () => q,
        limit: () => q,
        eq: () => q,
        maybeSingle: () => q,
        then: (resolve) =>
          Promise.resolve({
            data:
              table === "novori_api_usage_tracking"
                ? { enabled_at: "2026-10-05" }
                : table === "book_api_cache"
                  ? []
                  : [
                      {
                        provider:
                          table === "api_usage_daily"
                            ? "google_books"
                            : "hardcover",
                        usage_date: new Date().toISOString().slice(0, 10),
                        upstream_requests: 4,
                      },
                    ],
            count: 0,
          }).then(resolve),
      };
      return q;
    },
  };
  const result = await dispatchAdmin(
    client,
    { user: { id }, member: { role: "owner" } },
    { action: "usage" },
    { bookProvider: "isbndb", isbnDbConfigured: true },
  );
  assert.equal(result.summary.google_books.today, 4);
  assert.equal(result.summary.hardcover.today, 4);
  assert.equal(result.summary.hardcover.ready, true);
  assert.equal(result.summary.isbndb.today, 4);
  assert.equal(result.summary.isbndb.ready, true);
  assert.equal(result.configuration.book_provider, "isbndb");
  assert.equal(result.configuration.isbndb_key_configured, true);
  assert.ok(result.utc_window.start.endsWith("T00:00:00.000Z"));
  assert.ok(result.refreshed_at);
});

test('report priority ordering is applied in the database before pagination',async()=>{
 const calls=[],q={select:(...args)=>{calls.push(['select',...args]);return q;},order:(...args)=>{calls.push(['order',...args]);return q;},range:(...args)=>{calls.push(['range',...args]);return q;},eq:()=>q,then:resolve=>resolve({data:[],count:0})};
 await dispatchAdmin({from:table=>{assert.equal(table,'novori_report_priority');return q;}},{user:{id},member:{role:'owner'}},{action:'reports',page:2,status:'pending'});
 assert.deepEqual(calls.filter(c=>c[0]==='order').map(c=>c[1]),['priority_rank','first_open_report','id']);assert.deepEqual(calls.find(c=>c[0]==='range').slice(1),[100,149]);
});
test('support cannot approve unpublished submissions',async()=>{
 await assert.rejects(dispatchAdmin({}, {user:{id},member:{role:'support'}},{action:'review_screening',id:target}),/Moderator access required/);
});
