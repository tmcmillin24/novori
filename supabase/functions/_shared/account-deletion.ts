/** Service-only deletion orchestration. Storage removal must succeed before Auth deletion. */
export async function processAccountDeletions(client: any) {
  const claim = await client.rpc('claim_due_account_deletions', { batch_size: 10 });
  if (claim.error) throw claim.error;
  let completed = 0, failed = 0;
  for (const job of claim.data ?? []) {
    try {
      let exhausted = true;
      for (let pass = 0; pass < 10; pass++) {
        const objects = await client.rpc('account_deletion_storage_objects', { target_user_id: job.user_id, token: job.claim_token });
        if (objects.error) throw objects.error;
        if (!objects.data?.length) { exhausted = false; break; }
        const buckets = new Map<string, string[]>();
        for (const object of objects.data) {
          const names = buckets.get(object.bucket_id) ?? [];
          names.push(object.name); buckets.set(object.bucket_id, names);
        }
        for (const [bucket, names] of buckets) {
          for (let offset = 0; offset < names.length; offset += 100) {
            const removed = await client.storage.from(bucket).remove(names.slice(offset, offset + 100));
            if (removed.error) throw removed.error;
          }
        }
      }
      if (exhausted) throw new Error('Upload cleanup will continue on the next retry.');
      const prepared = await client.rpc('prepare_account_deletion', { target_user_id: job.user_id, token: job.claim_token });
      if (prepared.error) throw prepared.error;
      const removed = await client.auth.admin.deleteUser(job.user_id, false);
      if (removed.error) throw removed.error;
      completed++;
    } catch {
      // A failed claim stays processing; its lease expires and the scheduled worker retries.
      // Do not log email addresses, content, or auth tokens.
      failed++;
    }
  }
  return { completed, failed };
}

export async function sendDeletionReceipts(client: any, send: (receipt: { id: string; email: string }) => Promise<void>) {
  const now = new Date().toISOString();
  const expired = await client.from('account_deletion_receipts').delete().lte('expires_at', now);
  if (expired.error) throw expired.error;
  const queued = await client.from('account_deletion_receipts').select('id,email').is('user_id', null).gt('expires_at', now).limit(20);
  if (queued.error) throw queued.error;
  let sent = 0, failed = 0;
  for (const receipt of queued.data ?? []) {
    try {
      await send(receipt);
      const removed = await client.from('account_deletion_receipts').delete().eq('id', receipt.id);
      if (removed.error) throw removed.error;
      sent++;
    } catch { failed++; }
  }
  return { sent, failed };
}
