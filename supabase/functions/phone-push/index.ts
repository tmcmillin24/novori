import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { runPushWorker } from './worker.ts';

Deno.serve(async request => {
  const secret = Deno.env.get('NOVORI_PUSH_WORKER_SECRET');
  if (request.method !== 'POST' || !secret || request.headers.get('x-novori-worker') !== secret) return new Response('Unauthorized', { status: 401 });
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    const counts = await runPushWorker(async (name, args) => {
      const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(10000));
      if (error) throw new Error('Push database operation failed');
      return data;
    }, fetch, Deno.env.get('EXPO_PUSH_ACCESS_TOKEN'));
    console.info('[Novori push]', JSON.stringify(counts));
    return Response.json(counts);
  } catch {
    console.error('[Novori push] Worker failed; inspect queue state.');
    return Response.json({ error: 'Push worker unavailable' }, { status: 500 });
  }
});
