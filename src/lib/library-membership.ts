import type { UserBook } from './user-books';

type Membership = Pick<UserBook, 'owned' | 'status' | 'rating' | 'review_text' | 'started_at' | 'finished_at' | 'dnf_at'>;
/** An ownership-only record stops appearing after Owned is cleared; retain meaningful reader activity. */
export function hasLibraryMembership(book: Membership): boolean {
  return Boolean(book.owned || book.status || book.rating != null || book.review_text?.trim()
    || book.started_at || book.finished_at || book.dnf_at);
}
