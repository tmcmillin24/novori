// @ts-ignore -- resolved by the Supabase Edge runtime
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
// @ts-ignore -- module is shared with Node regression tests
import { createAdminHandler } from "../_shared/admin-hub.mjs";
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const url = Deno.env.get("SUPABASE_URL");
let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
try {
  key = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ?? key;
} catch {
  /* Legacy service key fallback. */
}
const origins = (
  Deno.env.get("NOVORI_ADMIN_ORIGINS") ?? "https://admin.novori.link"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (!url || !key) {
  Deno.serve(
    async () =>
      new Response(
        JSON.stringify({ error: "Admin backend is not configured." }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      ),
  );
} else {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
    },
  });
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const sendAlert = resendKey
    ? async (alert: { id: string; admin_id: string }) => {
        const { data, error } = await client.auth.admin.getUserById(
          alert.admin_id,
        );
        if (error || !data.user?.email || !data.user.email_confirmed_at)
          throw new Error("Verified admin email unavailable.");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `novori-report-${alert.id}`,
          },
          body: JSON.stringify({
            from:
              Deno.env.get("NOVORI_ADMIN_ALERT_FROM") ??
              "Novori <noreply@novori.link>",
            to: [data.user.email],
            subject: "A new Novori report needs review",
            text: "A reader submitted a report. Sign in to your private Novori admin hub to review it:\n\nhttps://admin.novori.link\n\nThis email intentionally contains no reported content or reporter identity.",
          }),
        });
        if (!response.ok)
          throw new Error("Admin report email could not be delivered.");
      }
    : undefined;
  Deno.serve(
    createAdminHandler({
      client,
      allowedOrigins: origins,
      requireMfa: true,
      sendAlert,
      workerSecret: Deno.env.get("NOVORI_ADMIN_WORKER_SECRET"),
      workerConfigured: Boolean(Deno.env.get("NOVORI_ADMIN_WORKER_SECRET")),
    }),
  );
}
