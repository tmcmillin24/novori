import { runPushWorker, type PushJob } from '../supabase/functions/phone-push/worker';
const job: PushJob = { id: 1, lease: 'lease', state: 'sending', attempts: 1, ticket: null, token: 'ExpoPushToken[test]', recipient: 'reader', notification: 'notice', title: 'Novori', body: 'An update' };
function harness(rows: PushJob[] = [job], valid = true) {
 const calls: { name: string; args?: Record<string, unknown> }[] = [];
 const rpc = async (name: string, args?: Record<string, unknown>) => {
  calls.push({ name, args });
  if (name === 'novori_claim_push') return rows;
  if (name === 'novori_push_still_valid') return valid;
  return null;
 };
 return { calls, rpc, finished: () => calls.filter(c => c.name === 'novori_finish_push').map(c => c.args!) };
}
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
it('records a ticket, sends only an authorized notification ID, and does not claim delivery yet', async () => {
 const h = harness(); const transport = jest.fn(async () => response({ data: { status: 'ok', id: 'ticket' } }));
 const counts = await runPushWorker(h.rpc, transport);
 expect(h.finished()[0]).toMatchObject({ p_state: 'receipt', p_ticket: 'ticket' });
 expect(counts).toMatchObject({ tickets: 1, receipts: 0 });
 const payload = JSON.parse((transport.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
 expect(payload.data).toEqual({ notification_id: 'notice', recipient_id: 'reader' });
 expect(payload.data.url).toBeUndefined();
});
it('rechecks account generation and preferences before sending', async () => {
 const h = harness([job], false); const transport = jest.fn();
 await runPushWorker(h.rpc, transport);
 expect(transport).not.toHaveBeenCalled();expect(h.finished()[0].p_state).toBe('skipped');
});
it('does not blindly replay an ambiguous send timeout', async () => {
 const h = harness();await runPushWorker(h.rpc, async () => { throw Error('timeout'); });
 expect(h.finished()[0]).toMatchObject({ p_state: 'uncertain', p_error: 'transport_error' });
});
it('retries explicit throttling and receipt transport failures', async () => {
 const h = harness();await runPushWorker(h.rpc, async () => response({},429));expect(h.finished()[0].p_state).toBe('pending');
 const r=harness([{ ...job,state:'checking',ticket:'ticket' }]);await runPushWorker(r.rpc,async()=>{throw Error('offline');});expect(r.finished()[0].p_state).toBe('receipt');
});
it('records provider receipts and deactivates only the associated generation for retired tokens', async () => {
 const h = harness([{ ...job,state:'checking',ticket:'ticket' }]);
 await runPushWorker(h.rpc,async()=>response({data:{ticket:{status:'error',details:{error:'DeviceNotRegistered'}}}}));
 expect(h.finished()[0]).toMatchObject({p_state:'failed',p_error:'DeviceNotRegistered',p_lease:'lease'});
});
it('waits for a receipt and marks provider acceptance only after a positive receipt', async () => {
 const h = harness([{...job,state:'checking',ticket:'ticket'}]);await runPushWorker(h.rpc,async()=>response({data:{}}));expect(h.finished()[0].p_state).toBe('receipt');
 const r = harness([{...job,state:'checking',ticket:'ticket'}]);await runPushWorker(r.rpc,async()=>response({data:{ticket:{status:'ok'}}}));expect(r.finished()[0].p_state).toBe('delivered');
});
it('does not turn a database persistence failure into a second send', async () => {
 const h=harness();const transport=jest.fn(async()=>response({data:{status:'ok',id:'ticket'}}));
 await expect(runPushWorker(async(name,args)=>{if(name==='novori_finish_push')throw Error('db');return h.rpc(name,args);},transport)).rejects.toThrow('db');
 expect(transport).toHaveBeenCalledTimes(1);
});
