import type { UserBook } from './user-books';
const listeners = new Set<(book: UserBook) => void>();
/** Confirmed writes only; no private library rows are retained in this event channel. */
export function publishUserBookChange(book: UserBook) {
  for (const listener of listeners) listener(book);
}
export function subscribeUserBookChanges(listener: (book: UserBook) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
