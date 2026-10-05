import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
const source = await readFile(
    new URL("../src/main.js", import.meta.url),
    "utf8",
  ),
  html = await readFile(
    new URL("../public/index.html", import.meta.url),
    "utf8",
  );
const id = "10000000-0000-4000-8000-000000000001",
  reportId = "10000000-0000-4000-8000-000000000002";
async function until(fn) {
  for (let i = 0; i < 100; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.fail("UI did not settle");
}
async function app({
  role = "owner",
  mfa = false,
  key = "sb_publishable_TEST",
  usage,
} = {}) {
  const dom = new JSDOM(html, {
      url: "https://admin.novori.link",
      runScripts: "outside-only",
    }),
    w = dom.window;
  let verified = !mfa;
  const calls = [];
  w.__CONFIG__ = { url: "https://oanpmuiuuwljknwvyzev.supabase.co", key };
  w.AbortSignal = AbortSignal;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.createClient = () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "test-token" } },
      }),
      signOut: async () => ({}),
      mfa: {
        listFactors: async () => ({
          data: { totp: [{ id, status: "verified" }] },
        }),
        challengeAndVerify: async () => {
          verified = true;
          return { data: {} };
        },
      },
    },
  });
  w.fetch = async (_url, options) => {
    const p = JSON.parse(options.body);
    calls.push(p);
    let data;
    if (p.action === "session")
      data = {
        role,
        email: "owner@example.test",
        mfa_required: !verified,
        email_alerts: true,
        worker_configured: true,
      };
    else if (p.action === "overview")
      data = {
        pending_reports: 1,
        readers: 6,
        clubs: 1,
        posts: 1,
        auth_jobs: 0,
        pending_alerts: 0,
        worker: null,
      };
    else if (p.action === "reports")
      data = {
        rows: [
          {
            id: reportId,
            target_type: "comment",
            reason: "harassment",
            status: "pending",
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      };
    else if (p.action === "report_detail")
      data = {
        report: {
          id: reportId,
          target_type: "comment",
          target_id: id,
          reason: "harassment",
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        content: { body: '<img src=x onerror="alert(1)">' },
        reader: { id, username: "reader" },
        restriction: null,
        parent: { body: "Post context" },
        thread: [],
        history: [],
      };
    else if (p.action === "usage") data = usage;
    else data = { completed: true };
    return { ok: true, status: 200, json: async () => ({ data }) };
  };
  w.eval(
    source
      .replace(/^import .*;\n/, "")
      .replace(/\b__CONFIG__\b/g, "window.__CONFIG__"),
  );
  return { dom, w, calls };
}
const click = (w, text) => {
  const b = [...w.document.querySelectorAll("button")].find(
    (n) => n.textContent === text,
  );
  assert.ok(b, `Missing button: ${text}`);
  b.click();
};
test("unconfigured deployment cannot sign in or fetch admin data", async () => {
  const { w, dom, calls } = await app({ key: "" });
  await until(() =>
    w.document.body.textContent.includes("configuration has not"),
  );
  assert.equal(calls.length, 0);
  assert.equal(w.document.querySelector("input"), null);
  dom.window.close();
});
test("MFA gate renders code input before any report or overview request", async () => {
  const { w, dom, calls } = await app({ mfa: true });
  await until(() => w.document.body.textContent.includes("Verify it’s you"));
  assert.deepEqual(
    calls.map((x) => x.action),
    ["session"],
  );
  const input = w.document.querySelector("input");
  input.value = "123456";
  input.form.dispatchEvent(new w.Event("submit", { cancelable: true }));
  await until(() => w.document.querySelector("nav"));
  assert.ok(calls.some((x) => x.action === "overview"));
  dom.window.close();
});
test("owner can inspect reported text without interpreting HTML and record a decision", async () => {
  const { w, dom, calls } = await app();
  await until(() => w.document.querySelector("nav"));
  click(w, "Reports");
  await until(() => w.document.querySelector(".list button"));
  w.document.querySelector(".list button").click();
  await until(
    () =>
      w.document.body.textContent.includes("Reported content") ||
      w.document.querySelector(".error"),
  );
  assert.equal(w.document.querySelector(".error")?.textContent, undefined);
  assert.ok(
    w.document.body.textContent.includes('<img src=x onerror="alert(1)">'),
  );
  assert.equal(w.document.querySelector("img[onerror]"), null);
  click(w, "Warn reader");
  assert.ok(w.document.querySelector("dialog").open);
  const reason = w.document.querySelector("dialog textarea");
  reason.value = "Please follow community rules.";
  reason.form.dispatchEvent(new w.Event("submit", { cancelable: true }));
  await until(() => calls.some((x) => x.action === "warn_reader"));
  const action = calls.find((x) => x.action === "warn_reader");
  assert.equal(action.target_type, "report");
  assert.equal(action.target_id, reportId);
  assert.ok(action.request_id);
  assert.ok(action.expected_updated_at);
  assert.equal(action.reason, "Please follow community rules.");
  dom.window.close();
});
test("support sees report context without moderation buttons", async () => {
  const { w, dom } = await app({ role: "support" });
  await until(() => w.document.querySelector("nav"));
  click(w, "Reports");
  await until(() => w.document.querySelector(".list button"));
  w.document.querySelector(".list button").click();
  await until(
    () =>
      w.document.body.textContent.includes("Reported content") ||
      w.document.querySelector(".error"),
  );
  assert.equal(w.document.querySelector(".error")?.textContent, undefined);
  assert.equal(
    [...w.document.querySelectorAll("button")].some(
      (b) => b.textContent === "Ban reader",
    ),
    false,
  );
  assert.ok(w.document.body.textContent.includes("support role"));
  dom.window.close();
});

test("API trackers show all three providers and all three periods", async () => {
  const { w, dom } = await app({
    usage: {
      note: "Recorded attempts, not billing",
      refreshed_at: "2026-10-05T03:00:00Z",
      summary: {
        google_books: {
          today: 2,
          days7: 20,
          days30: 200,
          first_recorded_day: "2026-09-29",
        },
        hardcover: {
          today: 3,
          days7: 30,
          days30: 300,
          ready: true,
          tracking: { enabled_at: "2026-10-05T03:00:00Z" },
        },
      },
      rows: [],
      cache: { rows: [], total: 0, sample_size: 0 },
    },
  });
  await until(() => w.document.querySelector("nav"));
  click(w, "API & cache");
  await until(() =>
    w.document.body.textContent.includes("Earliest recorded day"),
  );
  const cards = [...w.document.querySelectorAll(".card")];
  assert.equal(cards.length, 3);
  assert.match(cards[0].textContent, /Google Books/);
  assert.match(cards[1].textContent, /Hardcover/);
  assert.match(cards[2].textContent, /ISBNdb/);
  assert.match(cards[2].textContent, /Tracker setup required/);
  assert.deepEqual(
    [...cards[0].querySelectorAll("strong")].map((n) => n.textContent),
    ["2", "20", "200"],
  );
  assert.deepEqual(
    [...cards[1].querySelectorAll("strong")].map((n) => n.textContent),
    ["3", "30", "300"],
  );
  assert.match(cards[0].textContent, /Earlier history may be incomplete/);
  dom.window.close();
});

test("ISBNdb totals and deployed routing configuration render from the backend snapshot", async () => {
  const { w, dom } = await app({
    usage: {
      note: "Recorded attempts",
      refreshed_at: "2026-10-05T16:00:00Z",
      configuration: {
        book_provider: "isbndb",
        isbndb_key_configured: true,
        audit_version: "2026-10-05-api-audit-v1",
      },
      utc_window: {
        start: "2026-10-05T00:00:00Z",
        end: "2026-10-06T00:00:00Z",
      },
      summary: {
        google_books: { today: 0, days7: 2, days30: 5 },
        hardcover: { today: 144, days7: 144, days30: 144, ready: true },
        isbndb: {
          today: 81,
          days7: 90,
          days30: 90,
          ready: true,
          daily_safety_limit: 4500,
        },
      },
      rows: [],
      cache: {
        rows: [
          {
            provider: "hardcover_series",
            request_key: "publication:v1:a::b",
            hit_count: 0,
          },
        ],
        total: 1,
        sample_size: 1,
      },
    },
  });
  await until(() => w.document.querySelector("nav"));
  click(w, "API & cache");
  await until(() => w.document.body.textContent.includes("Backend version"));
  const isbn = [...w.document.querySelectorAll(".card")].find((card) =>
    card.textContent.includes("ISBNdb"),
  );
  assert.deepEqual(
    [...isbn.querySelectorAll("strong")].map((n) => n.textContent),
    ["81", "90", "90"],
  );
  assert.match(w.document.body.textContent, /Configured book provider: isbndb/);
  assert.match(w.document.body.textContent, /2026-10-05T00:00:00Z/);
  assert.match(w.document.body.textContent, /Derived publication date/);
  assert.match(w.document.body.textContent, /not API requests/);
  dom.window.close();
});
