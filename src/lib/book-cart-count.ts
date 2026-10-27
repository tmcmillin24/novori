import { supabase } from './supabase';

type Addition = { coverUrl?: string | null; title: string };
const listeners = new Set<() => void>();
const additions = new Set<(book: Addition) => void>();
const mutations = new Set<(change: { bookId: string; inCart: boolean }) => void>();
let userId: string | null = null;
let count: number | null = null;
let expiresAt = 0;
let version = 0;
let pending: Promise<void> | undefined;
let listening = false;
function emit() { for (const listener of listeners) listener(); }
function scope(id: string | null) {
  if (id === userId) return;
  userId = id; count = null; expiresAt = 0; pending = undefined; version++; emit();
}
export const subscribeBookCartCount = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getBookCartCountSnapshot = () => count;
export const subscribeCartAdditions = (listener: (book: Addition) => void) => { additions.add(listener); return () => { additions.delete(listener); }; };
export const subscribeBookCartMutations = (listener: (change: { bookId: string; inCart: boolean }) => void) => { mutations.add(listener); return () => { mutations.delete(listener); }; };
export function rememberBookCartCount(id: string, next: number) {
  if (id !== userId) return;
  version++; pending = undefined; count = next; expiresAt = Date.now() + 60_000; emit();
}
export async function refreshBookCartCount() {
  if (!listening && typeof supabase.auth.onAuthStateChange === 'function') {
    listening = true;
    supabase.auth.onAuthStateChange((_event, session) => scope(session?.user.id ?? null));
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  scope(data.session?.user.id ?? null);
  if (!userId || (count !== null && expiresAt > Date.now())) return;
  if (pending) return pending;
  const id = userId, generation = version;
  const request = (async () => {
    const result = await supabase.from('book_cart_items').select('id', { count: 'exact', head: true }).eq('user_id', id);
    if (result.error) throw result.error;
    if (userId === id && version === generation) {
      count = result.count ?? 0; expiresAt = Date.now() + 60_000; emit();
    }
  })();
  pending = request;
  try { await request; } finally { if (pending === request) pending = undefined; }
}
export function bookCartDidChange(id: string, bookId: string, added?: Addition) {
  if (id !== userId) return;
  version++; expiresAt = 0; pending = undefined;
  for (const listener of mutations) listener({ bookId, inCart: Boolean(added) });
  if (added) for (const listener of additions) listener(added);
  void refreshBookCartCount().catch(() => { /* Keep the last confirmed count until the next focus/retry. */ });
}
