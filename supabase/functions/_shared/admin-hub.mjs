/** All admin authorization lives here and in service-only SQL, never in browser visibility. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class AdminError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const validateId = (value) => {
  if (typeof value !== "string" || !UUID.test(value))
    throw new AdminError("A valid item ID is required.");
  return value;
};
const check = (result) => {
  if (result.error) {
    const code = result.error.code;
    throw new AdminError(
      code === "40001"
        ? "This item changed. Refresh before acting."
        : code === "42501"
          ? "This action is not allowed."
          : code === "P0002"
            ? "This item no longer exists."
            : code?.startsWith("22") || code?.startsWith("23")
              ? "The supplied details are invalid."
              : "The backend could not complete this request.",
      code === "40001"
        ? 409
        : code === "42501"
          ? 403
          : code === "P0002"
            ? 404
            : code?.startsWith("22") || code?.startsWith("23")
              ? 400
              : 503,
    );
  }
  return result.data;
};
const clampPage = (value) =>
  Math.max(0, Math.min(1000, Number.isInteger(value) ? value : 0));
function roleAllows(role, action) {
  if (
    [
      "edit_club",
      "pause_club",
      "resume_club",
      "save_announcement",
      "publish_announcement",
      "archive_announcement",
      "retry_jobs",
    ].includes(action)
  )
    return role === "owner";
  return role === "owner" || role === "moderator";
}
export async function authorizeAdmin(
  client,
  token,
  { requireMfa = true, allowEnrollment = false } = {},
) {
  if (!token) throw new AdminError("Sign in to continue.", 401);
  const result = await client.auth.getUser(token);
  if (result.error || !result.data?.user)
    throw new AdminError("Your session expired. Sign in again.", 401);
  const user = result.data.user;
  const member = check(
    await client
      .from("novori_admin_members")
      .select("user_id,role,enabled,email_alerts")
      .eq("user_id", user.id)
      .maybeSingle(),
  );
  if (!member?.enabled)
    throw new AdminError("This account has no Novori admin access.", 403);
  if (check(await client.rpc("novori_reader_restricted", { p_user: user.id })))
    throw new AdminError("This administrator account is restricted.", 403);
  if (!check(await client.rpc("novori_account_active", { reader_id: user.id })))
    throw new AdminError("This administrator account is unavailable.", 403);
  let aal = "aal1";
  try {
    const claims = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    aal = claims.aal ?? "aal1";
  } catch {
    /* Identity already verified by Auth; invalid/unavailable assurance fails closed. */
  }
  if (requireMfa && aal !== "aal2" && !allowEnrollment)
    throw new AdminError("Verify your authenticator code to continue.", 403);
  return { user, member, mfa_required: requireMfa && aal !== "aal2" };
}
export async function runAdminJobs(client, { sendAlert } = {}) {
  let synchronized = 0,
    failed = 0,
    delivered = 0,
    alerts = 0;
  const deadline = Date.now() + 40000;
  for (let i = 0; i < 10 && Date.now() < deadline; i++) {
    const job = check(await client.rpc("novori_admin_claim_auth_job"));
    if (!job) break;
    if (job.superseded) continue;
    let success = false;
    try {
      const seconds = job.blocked_until
        ? Math.max(
            0,
            Math.ceil((Date.parse(job.blocked_until) - Date.now()) / 1000),
          )
        : 0;
      const ban_duration = job.permanent
        ? "876000h"
        : seconds
          ? `${seconds}s`
          : "none";
      const result = await client.auth.admin.updateUserById(job.user_id, {
        ban_duration,
      });
      success = !result.error;
    } catch {
      /* The durable job remains retryable; never log reader identities or auth tokens. */
    }
    check(
      await client.rpc("novori_admin_finish_auth_job", {
        p_id: job.id,
        p_token: job.claim_token,
        p_success: success,
      }),
    );
    if (success) synchronized++;
    else {
      failed++;
      break;
    }
  }
  const announcements = check(
    await client
      .from("novori_admin_announcements")
      .select("id")
      .eq("state", "published")
      .eq("delivery_complete", false)
      .order("published_at")
      .limit(10),
  );
  for (const row of announcements ?? []) {
    if (Date.now() >= deadline) break;
    delivered += Number(
      check(
        await client.rpc("novori_admin_deliver_announcement", { p_id: row.id }),
      ) ?? 0,
    );
  }
  if (sendAlert)
    for (let i = 0; i < 20 && Date.now() < deadline; i++) {
      const alert = check(await client.rpc("novori_admin_claim_alert"));
      if (!alert) break;
      let success = false;
      try {
        await sendAlert(alert);
        success = true;
      } catch {
        /* Retry on the next worker invocation. */
      }
      check(
        await client.rpc("novori_admin_finish_alert", {
          p_id: alert.id,
          p_token: alert.claim_token,
          p_success: success,
        }),
      );
      if (success) alerts++;
      else {
        failed++;
        break;
      }
    }
  return { synchronized, failed, delivered, alerts };
}
async function overview(client) {
  const count = async (table, filter) => {
    let q = client.from(table).select("id", { count: "exact", head: true });
    if (table === "novori_admin_auth_jobs")
      q = q.in("status", ["pending", "processing"]);
    else if (filter) q = q.eq(...filter);
    const r = await q;
    check(r);
    return r.count;
  };
  const values = await Promise.all([
    count("content_reports", ["status", "pending"]),
    count("profiles"),
    count("clubs"),
    count("posts"),
    count("novori_admin_auth_jobs"),
    count("novori_admin_report_alerts", ["status", "pending"]),
  ]);
  return Object.fromEntries(
    [
      "pending_reports",
      "readers",
      "clubs",
      "posts",
      "auth_jobs",
      "pending_alerts",
    ].map((key, i) => [key, values[i]]),
  );
}
export async function dispatchAdmin(client, identity, input, settings = {}) {
  const { member, user } = identity,
    action = input.action;
  if (action === "session")
    return {
      role: member.role,
      email: user.email,
      mfa_required: identity.mfa_required,
      email_alerts: member.email_alerts,
      email_alerts_configured: Boolean(settings.sendAlert),
      worker_configured: Boolean(settings.workerConfigured),
    };
  if (action === "overview")
    return {
      ...(await overview(client)),
      worker: check(
        await client
          .from("novori_admin_worker_status")
          .select("last_heartbeat,last_result")
          .eq("singleton", true)
          .maybeSingle(),
      ),
    };
  const page = clampPage(input.page),
    start = page * 50;
  if (action === "reports") {
    let query = client
      .from("content_reports")
      .select("id,target_type,target_id,reason,status,created_at,updated_at", {
        count: "exact",
      })
      .order("updated_at", { ascending: false })
      .range(start, start + 49);
    if (["pending", "reviewed", "actioned", "dismissed"].includes(input.status))
      query = query.eq("status", input.status);
    const r = await query;
    const rows = check(r);
    return { rows, total: r.count, page };
  }
  if (action === "report_detail") {
    const id = validateId(input.id);
    const report = check(
      await client
        .from("content_reports")
        .select("id,target_type,target_id,reason,status,created_at,updated_at")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!report) throw new AdminError("Report no longer exists.", 404);
    const table = {
      post: "posts",
      comment: "post_comments",
      profile: "profiles",
    }[report.target_type];
    if (!table) throw new AdminError("Unsupported report target.");
    const fields = {
      post: "id,author_id,club_id,body,post_type,created_at,updated_at,post_image_url",
      comment:
        "id,post_id,parent_comment_id,author_id,body,created_at,updated_at",
      profile: "id,username,display_name,bio,avatar_url",
    }[report.target_type];
    const content = check(
      await client
        .from(table)
        .select(fields)
        .eq("id", report.target_id)
        .maybeSingle(),
    );
    const readerId =
      report.target_type === "profile" ? report.target_id : content?.author_id;
    const reader = readerId
      ? check(
          await client
            .from("profiles")
            .select("id,username,display_name,avatar_url")
            .eq("id", readerId)
            .maybeSingle(),
        )
      : null;
    const restriction = readerId
      ? check(
          await client
            .from("novori_reader_restrictions")
            .select("blocked_until,permanent,reason,updated_at")
            .eq("user_id", readerId)
            .maybeSingle(),
        )
      : null;
    let parent = null,
      thread = [];
    if (content?.post_id) {
      parent = check(
        await client
          .from("posts")
          .select("id,author_id,body")
          .eq("id", content.post_id)
          .maybeSingle(),
      );
      thread =
        check(
          await client
            .from("post_comments")
            .select("id,parent_comment_id,author_id,body,created_at")
            .eq("post_id", content.post_id)
            .order("created_at")
            .limit(100),
        ) ?? [];
    }
    const reportCount = readerId
      ? check(
          await client
            .from("novori_admin_audit")
            .select("action,reason,created_at")
            .or(
              `and(target_type.eq.reader,target_id.eq.${readerId}),and(target_type.eq.report,target_id.eq.${id}),result->>reader_id.eq.${readerId}`,
            )
            .order("created_at", { ascending: false })
            .limit(20),
        )
      : [];
    return {
      report,
      content,
      reader,
      restriction,
      parent,
      thread,
      history: reportCount,
    };
  }
  if (action === "readers" || action === "clubs") {
    const fields =
      action === "readers"
        ? "id,username,display_name,avatar_url,created_at"
        : "id,name,description,rules,owner_id,privacy,created_at,updated_at";
    let query = client
      .from(action === "readers" ? "profiles" : "clubs")
      .select(fields, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(start, start + 49);
    const search =
      typeof input.search === "string" ? input.search.trim().slice(0, 100) : "";
    if (search) {
      if (!/^[\p{L}\p{N} @._'-]+$/u.test(search))
        throw new AdminError(
          "Search using letters, numbers, spaces, or a username.",
        );
      const escaped = search.replace(/[%_]/g, "\\$&");
      query = query.ilike(
        action === "readers" ? "username" : "name",
        `%${escaped}%`,
      );
    }
    const r = await query;
    const rows = check(r);
    return { rows, total: r.count, page };
  }
  if (action === "reader_detail") {
    const id = validateId(input.id);
    const reader = check(
      await client
        .from("profiles")
        .select("id,username,display_name,bio,avatar_url,created_at")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!reader) throw new AdminError("Reader no longer exists.", 404);
    const restriction = check(
      await client
        .from("novori_reader_restrictions")
        .select("blocked_until,permanent,reason,updated_at")
        .eq("user_id", id)
        .maybeSingle(),
    );
    const jobs = check(
      await client
        .from("novori_admin_auth_jobs")
        .select("id,status,attempts,last_error,created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
    );
    const history = check(
      await client
        .from("novori_admin_audit")
        .select("action,reason,created_at,result")
        .or(
          `and(target_type.eq.reader,target_id.eq.${id}),result->>reader_id.eq.${id}`,
        )
        .order("created_at", { ascending: false })
        .limit(25),
    );
    // Account support receives confirmation state, not passwords, tokens or private reading notes.
    const auth = await client.auth.admin.getUserById(id);
    if (auth.error)
      throw new AdminError("Account details are temporarily unavailable.", 503);
    return {
      reader,
      restriction,
      jobs,
      history,
      account: {
        email:
          member.role === "owner" || member.role === "support"
            ? auth.data.user.email
            : undefined,
        email_confirmed: Boolean(auth.data.user.email_confirmed_at),
        last_sign_in_at: auth.data.user.last_sign_in_at,
        banned_until: auth.data.user.banned_until,
      },
    };
  }
  if (action === "club_detail") {
    const id = validateId(input.id);
    const club = check(
      await client
        .from("clubs")
        .select(
          "id,name,description,rules,owner_id,privacy,created_at,updated_at",
        )
        .eq("id", id)
        .maybeSingle(),
    );
    if (!club) throw new AdminError("Club no longer exists.", 404);
    const control = check(
      await client
        .from("novori_club_controls")
        .select("posting_paused,reason,updated_at")
        .eq("club_id", id)
        .maybeSingle(),
    );
    const members = check(
      await client
        .from("club_members")
        .select("user_id,role,joined_at")
        .eq("club_id", id)
        .order("joined_at")
        .limit(100),
    );
    return { club, control, members };
  }
  if (action === "announcements") {
    const r = await client
      .from("novori_admin_announcements")
      .select(
        "id,title,body,state,created_at,updated_at,published_at,delivered_count,delivery_complete",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(start, start + 49);
    return { rows: check(r), total: r.count, page };
  }
  if (action === "usage") {
    const result = await client
      .from("api_usage_daily")
      .select("*")
      .gte(
        "usage_date",
        new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10),
      )
      .order("usage_date", { ascending: false })
      .limit(300);
    const rows = check(result);
    const cache = await client
      .from("book_api_cache")
      .select("provider,hit_count,fetched_at,expires_at", { count: "exact" })
      .order("fetched_at", { ascending: false })
      .limit(100);
    return {
      rows,
      cache: {
        rows: check(cache),
        total: cache.count,
        sample_size: cache.data?.length ?? 0,
      },
      note: "Usage is Novori’s recorded upstream traffic, not provider billing. Cache details show the 100 most recently fetched entries.",
    };
  }
  if (action === "audit") {
    const r = await client
      .from("novori_admin_audit")
      .select(
        "id,actor_id,action,target_type,target_id,reason,result,created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(start, start + 49);
    return { rows: check(r), total: r.count, page };
  }
  if (action === "alert_preferences") {
    if (typeof input.enabled !== "boolean")
      throw new AdminError("Choose an alert preference.");
    check(
      await client
        .from("novori_admin_members")
        .update({ email_alerts: input.enabled })
        .eq("user_id", user.id),
    );
    return { completed: true };
  }
  if (action === "retry_jobs") {
    if (member.role !== "owner")
      throw new AdminError("Owner access required.", 403);
    return runAdminJobs(client, settings);
  }
  if (!roleAllows(member.role, action))
    throw new AdminError("This action is not allowed for your role.", 403);
  validateId(input.target_id);
  validateId(input.request_id);
  const result = check(
    await client.rpc("novori_admin_apply_action", {
      p_actor: user.id,
      p_request: input.request_id,
      p_action: action,
      p_target_type: input.target_type,
      p_target: input.target_id,
      p_reason: input.reason,
      p_expected: input.expected_updated_at ?? null,
      p_payload: input.payload ?? {},
    }),
  );
  if (result?.auth_sync_pending || action === "publish_announcement") {
    try {
      return { ...result, jobs: await runAdminJobs(client, settings) };
    } catch {
      return { ...result, jobs_pending: true };
    }
  }
  return result;
}
export function createAdminHandler({
  client,
  allowedOrigins,
  requireMfa = true,
  sendAlert,
  workerSecret,
  workerConfigured = false,
}) {
  return async (request) => {
    const origin = request.headers.get("Origin");
    const allowed = origin && allowedOrigins.includes(origin);
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
      ...(allowed
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Headers":
              "authorization,apikey,content-type,x-client-info",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
          }
        : {}),
    };
    const respond = (value, status = 200) =>
      new Response(JSON.stringify(value), { status, headers });
    if (origin && !allowed)
      return respond({ error: "Origin not allowed." }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return respond({ error: "POST required." }, 405);
    try {
      const supplied = request.headers.get("x-admin-worker-secret");
      if (supplied) {
        let difference = (workerSecret?.length ?? 0) ^ supplied.length;
        for (let i = 0; i < (workerSecret?.length ?? 0); i++)
          difference |=
            workerSecret.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
        if (!workerSecret || workerSecret.length < 32 || difference !== 0)
          throw new AdminError("Unauthorized worker.", 401);
        const data = await runAdminJobs(client, { sendAlert });
        check(
          await client
            .from("novori_admin_worker_status")
            .upsert({
              singleton: true,
              last_heartbeat: new Date().toISOString(),
              last_result: data,
            }),
        );
        return respond({ data });
      }
      if (Number(request.headers.get("content-length")) > 16384)
        throw new AdminError("Request too large.", 413);
      const text = await request.text();
      if (text.length > 16384) throw new AdminError("Request too large.", 413);
      let input;
      try {
        input = JSON.parse(text);
      } catch {
        throw new AdminError("Invalid request.");
      }
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new AdminError("Invalid request.");
      const token = (request.headers.get("Authorization") ?? "")
        .replace(/^Bearer\s+/i, "")
        .trim();
      const identity = await authorizeAdmin(client, token, {
        requireMfa,
        allowEnrollment: input.action === "session",
      });
      return respond({
        data: await dispatchAdmin(client, identity, input, {
          sendAlert,
          workerConfigured,
        }),
      });
    } catch (error) {
      return respond(
        {
          error:
            error instanceof AdminError
              ? error.message
              : "The admin service is temporarily unavailable.",
        },
        error instanceof AdminError ? error.status : 503,
      );
    }
  };
}
