export type PushJob = { id: number; lease: string; state: 'sending' | 'checking'; attempts: number; ticket: string | null; token: string; recipient: string; notification: string; title: string; body: string };
type RPC = (name: string, args?: Record<string, unknown>) => Promise<any>;
type ExpoFetch = (url: string, init: RequestInit) => Promise<Response>;
export async function runPushWorker(rpc: RPC, transport: ExpoFetch = fetch, accessToken?: string) {
  const jobs: PushJob[] = await rpc('novori_claim_push');
  const counts = { claimed: jobs.length, tickets: 0, receipts: 0, failed: 0, retried: 0, skipped: 0, uncertain: 0 };
  async function finish(job: PushJob, state: string, error: string | null = null, ticket: string | null = null) {
    await rpc('novori_finish_push', { p_id: job.id, p_lease: job.lease, p_state: state, p_error: error, p_ticket: ticket });
  }
  async function process(job: PushJob) {
    let requestStarted = false;
    let outcome: { state: string; error?: string; ticket?: string };
    try {
      if (job.state === 'sending' && !await rpc('novori_push_still_valid', { p_id: job.id, p_lease: job.lease })) {
        await finish(job, 'skipped'); counts.skipped++; return;
      }
      const receipt = job.state === 'checking';
      const payload = receipt ? { ids: [job.ticket] } : {
        to: job.token, title: job.title, body: job.body, sound: 'default', channelId: 'novori', ttl: 86400,
        data: { notification_id: job.notification, recipient_id: job.recipient },
      };
      requestStarted = true;
      const response = await transport(`https://exp.host/--/api/v2/push/${receipt ? 'getReceipts' : 'send'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(12000),
      });
      if (response.status === 429 || response.status >= 500) outcome = { state: receipt ? 'receipt' : 'pending', error: `expo_http_${response.status}` };
      else if (!response.ok) outcome = { state: 'failed', error: `expo_http_${response.status}` };
      else {
        const result = await response.json();
        const value = receipt ? result.data?.[job.ticket!] : Array.isArray(result.data) ? result.data[0] : result.data;
        if (receipt && !value) outcome = { state: 'receipt', error: 'receipt_pending' };
        else if (value?.status === 'ok') outcome = receipt ? { state: 'delivered' } : typeof value.id === 'string' ? { state: 'receipt', ticket: value.id } : { state: 'uncertain', error: 'missing_ticket' };
        else if (value?.details?.error === 'MessageRateExceeded') outcome = { state: receipt ? 'receipt' : 'pending', error: 'MessageRateExceeded' };
        else outcome = { state: 'failed', error: typeof value?.details?.error === 'string' ? value.details.error : 'expo_rejected' };
      }
    } catch {
      // A timed-out POST may have been accepted. Do not duplicate it on retry.
      outcome = { state: job.state === 'checking' ? 'receipt' : requestStarted ? 'uncertain' : 'pending', error: 'transport_error' };
    }
    // If persistence fails, leave the lease intact. The next worker distinguishes
    // interrupted sends from receipt lookups instead of immediately sending twice.
    await finish(job, outcome.state, outcome.error ?? null, outcome.ticket ?? null);
    if (outcome.state === 'receipt') job.state === 'checking' ? counts.retried++ : counts.tickets++;
    else if (outcome.state === 'delivered') counts.receipts++;
    else if (outcome.state === 'pending') counts.retried++;
    else if (outcome.state === 'uncertain') counts.uncertain++;
    else counts.failed++;
  }
  // Five bounded concurrent requests keep a full batch within the Edge runtime.
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(5, jobs.length) }, async () => {
    while (cursor < jobs.length) await process(jobs[cursor++]);
  }));
  return counts;
}
