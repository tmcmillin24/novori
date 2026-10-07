import { getPostDetail, markPostMutation } from './feed';
import { isRecapSharePeriod, parseReadingRecapSnapshot, type ReadingRecapKind, type ReadingRecapSnapshot } from './reading-recap-card';
import { supabase } from './supabase';

async function readerId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Sign in to share a reading recap.');
  return user.id;
}
function timezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
function rpcError(error: { code?: string; message?: string }) {
  return new Error(error.code === 'PGRST202' || error.code === '42883'
    ? 'Recap sharing is temporarily unavailable. Please try again later.' : error.message || 'Could not share this recap.');
}
export async function getReadingRecapSnapshot(kind: ReadingRecapKind, periodStart: string): Promise<ReadingRecapSnapshot> {
  if (!isRecapSharePeriod(kind,periodStart)) throw new Error('Choose a valid reading period.');
  await readerId();
  const { data, error } = await supabase.rpc('get_reading_recap_snapshot', { recap_kind: kind, period_start: periodStart, reader_timezone: timezone() });
  if (error) throw rpcError(error);
  const snapshot = parseReadingRecapSnapshot(data);
  if (!snapshot || snapshot.kind !== kind || snapshot.periodStart !== periodStart) throw new Error('Could not load this recap. Please try again.');
  return snapshot;
}
export async function getEditableReadingRecap(postId: string) {
  const id = await readerId();
  const post = await getPostDetail(postId);
  if (post.author_id !== id || !parseReadingRecapSnapshot(post.reading_recap)) throw new Error('This recap is unavailable.');
  return post;
}
export function createRecapShareKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
export async function publishReadingRecap(snapshot: ReadingRecapSnapshot, caption: string, clubId: string | null, requestKey: string): Promise<string> {
  if (!parseReadingRecapSnapshot(snapshot)) throw new Error('Reload your recap before sharing.');
  if (caption.trim().length > 1200) throw new Error('Captions can be up to 1,200 characters.');
  if (requestKey.length < 16 || requestKey.length > 100) throw new Error('Reload your recap before sharing.');
  await readerId();
  const { data, error } = await supabase.rpc('publish_reading_recap_post', {
    recap_kind: snapshot.kind, period_start: snapshot.periodStart, reader_timezone: timezone(), expected_snapshot: snapshot,
    target_club_id: clubId, post_caption: caption.trim(), share_request_key: requestKey,
  });
  if (error) throw rpcError(error);
  if (typeof data !== 'string' || !data) throw new Error('Could not confirm this post. Please try again.');
  markPostMutation(); return data;
}
export async function updateReadingRecap(postId: string, caption: string, clubId: string | null): Promise<string> {
  if (caption.trim().length > 1200) throw new Error('Captions can be up to 1,200 characters.');
  await readerId();
  const { data, error } = await supabase.rpc('update_reading_recap_post', { target_post_id: postId, target_club_id: clubId, post_caption: caption.trim() });
  if (error) throw rpcError(error);
  if (typeof data !== 'string' || !data) throw new Error('Could not confirm this update. Please try again.');
  markPostMutation(); return data;
}
