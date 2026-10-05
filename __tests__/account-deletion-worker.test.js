import { processAccountDeletions, sendDeletionReceipts } from '../supabase/functions/_shared/account-deletion';
const job = { user_id: 'reader-1', claim_token: 'claim-1' };
function client(objects = []) {
  const calls = [];
  const remove = jest.fn(async paths => { calls.push(['storage', paths]); return { error: null }; });
  let pages = [objects, []];
  const rpc = jest.fn(async name => { calls.push([name]); return { data: name === 'claim_due_account_deletions' ? [job] : name === 'account_deletion_storage_objects' ? pages.shift() ?? [] : null, error: null }; });
  const deleteUser = jest.fn(async () => { calls.push(['auth']); return { error: null }; });
  return { rpc, storage: { from: jest.fn(() => ({ remove })) }, auth: { admin: { deleteUser } }, calls, remove };
}
test('removes uploads from their own buckets before preparing content and hard-deleting Auth', async () => {
  const api = client([{ bucket_id: 'avatars', name: 'reader-1/avatar.jpg' }, { bucket_id: 'post-media', name: 'reader-1/photo.jpg' }]);
  expect(await processAccountDeletions(api)).toEqual({ completed: 1, failed: 0 });
  expect(api.storage.from.mock.calls).toEqual([['avatars'], ['post-media']]);
  expect(api.calls.map(c => c[0])).toEqual(['claim_due_account_deletions', 'account_deletion_storage_objects', 'storage', 'storage', 'account_deletion_storage_objects', 'prepare_account_deletion', 'auth']);
  expect(api.auth.admin.deleteUser).toHaveBeenCalledWith('reader-1', false);
});
test('storage failure leaves the claim for retry and never prepares or deletes the account', async () => {
  const api = client([{ bucket_id: 'avatars', name: 'reader-1/avatar.jpg' }]); api.remove.mockResolvedValue({ error: { message: 'Storage unavailable' } });
  expect(await processAccountDeletions(api)).toEqual({ completed: 0, failed: 1 });
  expect(api.rpc).not.toHaveBeenCalledWith('prepare_account_deletion', expect.anything()); expect(api.auth.admin.deleteUser).not.toHaveBeenCalled();
});
test('expired claim or failed content cleanup never reaches Auth deletion', async () => {
  const api = client(), normal = api.rpc.getMockImplementation(); api.rpc.mockImplementation(async (name, args) => name === 'prepare_account_deletion' ? { error: { message: 'Invalid claim' } } : normal(name, args));
  expect(await processAccountDeletions(api)).toEqual({ completed: 0, failed: 1 }); expect(api.auth.admin.deleteUser).not.toHaveBeenCalled();
});
test('an auth failure remains retryable after successful idempotent content preparation', async () => {
  const api = client(); api.auth.admin.deleteUser.mockResolvedValueOnce({ error: { message: 'Auth unavailable' } });
  expect(await processAccountDeletions(api)).toEqual({ completed: 0, failed: 1 });
  expect(await processAccountDeletions(api)).toEqual({ completed: 1, failed: 0 });
});
test('removes receipt email only after delivery succeeds and keeps failed receipts for retry', async () => {
  const rows = [{ id: 'a', email: 'a@example.com' }, { id: 'b', email: 'b@example.com' }];
  const eq = jest.fn(async () => ({ error: null }));
  const api = { from: jest.fn(() => ({ delete: () => ({ lte: async () => ({ error: null }), eq }), select: () => ({ is: () => ({ gt: () => ({ limit: async () => ({ data: rows, error: null }) }) }) }) })) };
  const send = jest.fn(async row => { if (row.id === 'b') throw Error('Offline'); });
  expect(await sendDeletionReceipts(api, send)).toEqual({ sent: 1, failed: 1 }); expect(eq.mock.calls).toEqual([['id', 'a']]);
});

test('moderation image cleanup completes before content and Auth deletion',async()=>{
 const api=client(),cleanup=jest.fn(async(_client,user)=>{expect(user).toBe(job.user_id);api.calls.push(['moderation']);});
 expect(await processAccountDeletions(api,cleanup)).toEqual({completed:1,failed:0});
 expect(api.calls.map(c=>c[0])).toEqual(['claim_due_account_deletions','account_deletion_storage_objects','moderation','prepare_account_deletion','auth']);
});
test('failed quarantine cleanup prevents Auth deletion and remains retryable',async()=>{
 const api=client();expect(await processAccountDeletions(api,async()=>{throw Error('Storage unavailable');})).toEqual({completed:0,failed:1});expect(api.auth.admin.deleteUser).not.toHaveBeenCalled();expect(api.rpc).not.toHaveBeenCalledWith('prepare_account_deletion',expect.anything());
});
