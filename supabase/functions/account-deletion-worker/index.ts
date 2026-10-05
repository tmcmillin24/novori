// Supabase's Edge runtime resolves the npm specifier and supplies Deno.
// @ts-ignore -- resolved by Deno in production
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
// @ts-ignore -- Deno requires the explicit extension
import { processAccountDeletions, sendDeletionReceipts } from '../_shared/account-deletion.ts';
import { cleanupReaderModerationMedia } from '../_shared/ugc-deletion.mjs';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
function sameSecret(a: string, b: string) {
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) mismatch |= (a.charCodeAt(i) || 0) ^ b.charCodeAt(i);
  return mismatch === 0;
}
Deno.serve(async req => {
  const secret = Deno.env.get('ACCOUNT_DELETION_CRON_SECRET');
  if (!secret || secret.length < 32 || !sameSecret(req.headers.get('x-deletion-secret') ?? '', secret)) return json({ error: 'Unauthorized' }, 401);
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), resendKey = Deno.env.get('RESEND_API_KEY');
  if (!url || !key || !resendKey) return json({ error: 'Deletion worker is not configured.' }, 503);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const deletion = await processAccountDeletions(client, cleanupReaderModerationMedia);
    const receipts = await sendDeletionReceipts(client, async (receipt: { id: string; email: string }) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `account-deleted-${receipt.id}` },
        body: JSON.stringify({ from: 'Novori <noreply@novori.link>', to: [receipt.email], subject: 'Your Novori account has been deleted',
          text: 'Your Novori account and personal reading data have been permanently deleted from our active systems. Your posts and comments have been replaced with anonymous deletion notices so other readers’ replies can remain. Shared book catalog data is retained. Provider security logs and backup copies expire according to our hosting providers’ retention schedules.\n\nRead. Discuss. Belong.\nNovori' }),
      });
      if (!response.ok) throw new Error('Receipt delivery failed.');
    });
    // A recent heartbeat is required before the app accepts new deletion requests.
    const heartbeat = await client.from('account_deletion_config').update({ last_heartbeat: new Date().toISOString() }).eq('singleton', true);
    if (heartbeat.error) throw heartbeat.error;
    if (deletion.failed || receipts.failed) console.error('Account deletion retry needed', { cleanupFailures: deletion.failed, receiptFailures: receipts.failed });
    return json({ ready: true, deletion, receipts });
  } catch {
    console.error('Account deletion worker failed; next scheduled invocation will retry.');
    return json({ error: 'Deletion worker will retry.' }, 500);
  }
});
