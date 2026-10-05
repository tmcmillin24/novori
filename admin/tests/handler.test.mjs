import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authorizeAdmin,
  createAdminHandler,
  dispatchAdmin,
  runAdminJobs,
  validateId,
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
