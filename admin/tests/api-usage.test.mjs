import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("read-only usage verification matches UTC totals without backfilling a provider gap", async () => {
  const db = new PGlite();
  try {
    await db.exec(`set timezone='Pacific/Honolulu';
   create table api_usage_daily(provider text,usage_date date,upstream_requests bigint);
   create table novori_api_usage_daily(provider text,usage_date date,upstream_requests bigint);
   create table novori_isbndb_usage_daily(usage_date date,upstream_requests bigint,last_request_at timestamptz);
   create table novori_api_usage_tracking(provider text,last_request_at timestamptz);
   insert into novori_api_usage_daily values('hardcover',(now() at time zone 'UTC')::date,144);
   insert into novori_api_usage_daily values('hardcover',(now() at time zone 'UTC')::date-6,10);
   insert into novori_api_usage_daily values('hardcover',(now() at time zone 'UTC')::date-7,20);
   insert into novori_api_usage_daily values('hardcover',(now() at time zone 'UTC')::date+1,999);
   insert into novori_isbndb_usage_daily values((now() at time zone 'UTC')::date,81,now());`);
    const { rows } = await db.query(
      await readFile(
        new URL("../verify-api-usage.sql", import.meta.url),
        "utf8",
      ),
    );
    const hardcover = rows.find((row) => row.provider === "hardcover");
    assert.equal(Number(hardcover.today_requests), 144);
    assert.equal(Number(hardcover.last_7_days_requests), 154);
    assert.equal(Number(hardcover.last_30_days_requests), 174);
    assert.equal(
      Number(rows.find((row) => row.provider === "isbndb").today_requests),
      81,
    );
    assert.equal(
      Number(
        rows.find((row) => row.provider === "google_books").today_requests,
      ),
      0,
    );
    assert.equal(
      (
        await db.query(
          "select upstream_requests from novori_api_usage_daily where upstream_requests=144",
        )
      ).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
