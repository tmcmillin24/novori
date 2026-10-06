import type { UserBookStatus } from './user-books';
export type ConfirmedReadingStatus = { bookId: string; status: UserBookStatus };
/** A successful local write outranks background snapshots for this book page. */
export function getDisplayedReadingStatus(
  bookId: string | undefined,
  confirmed: ConfirmedReadingStatus | null,
  loaded: UserBookStatus | null,
): UserBookStatus | null {
  return confirmed && confirmed.bookId === bookId ? confirmed.status : loaded;
}
