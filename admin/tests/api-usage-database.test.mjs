import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("Hardcover counter is atomic, service-only, UTC-based and safe to rerun", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;",
    );
    const sql = await readFile(
      new URL(
        "../../supabase/migrations/20261005034000_api_usage_trackers.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(sql);
    const enabled = (
      await db.query("select enabled_at from novori_api_usage_tracking")
    ).rows[0].enabled_at;
    await Promise.all(
      Array.from({ length: 20 }, () =>
        db.query("select novori_record_hardcover_request()"),
      ),
    );
    await db.exec(sql);
    const row = (await db.query("select * from novori_api_usage_daily"))
      .rows[0];
    assert.equal(Number(row.upstream_requests), 20);
    assert.equal(
      new Date(row.usage_date).toISOString().slice(0, 10),
      new Date().toISOString().slice(0, 10),
    );
    const tracking = (await db.query("select * from novori_api_usage_tracking"))
      .rows[0];
    assert.deepEqual(tracking.enabled_at, enabled);
    assert.ok(tracking.first_request_at);
    assert.ok(tracking.last_request_at);
    for (const role of ["anon", "authenticated"]) {
      const privileges = (
        await db.query(
          `select has_function_privilege('${role}','novori_record_hardcover_request()','execute') fn,has_table_privilege('${role}','novori_api_usage_daily','select') tbl`,
        )
      ).rows[0];
      assert.equal(privileges.fn, false);
      assert.equal(privileges.tbl, false);
    }
    await db.exec(
      "set role service_role;select novori_record_hardcover_request();reset role;",
    );
    assert.equal(
      Number(
        (await db.query("select upstream_requests from novori_api_usage_daily"))
          .rows[0].upstream_requests,
      ),
      21,
    );
  } finally {
    await db.close();
  }
});
