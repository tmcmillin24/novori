export type ProfileBookStatus =
  | 'reading'
  | 'want_to_read'
  | 'read'
  | 'dnf';

export const PROFILE_BOOK_STATUS_LABELS:
  Record<ProfileBookStatus, string> = {
    reading: 'Reading',
    want_to_read: 'TBR',
    read: 'Read',
    dnf: 'DNF',
  };

const PROFILE_BOOK_STATUS_ORDER:
  Record<ProfileBookStatus, number> = {
    reading: 0,
    want_to_read: 1,
    read: 2,
    dnf: 3,
  };

type ProfileBookLike = {
  status: ProfileBookStatus;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  dnf_at?: string | null;
};

function getProfileBookTime(
  book: ProfileBookLike
) {
  const source =
    book.status === 'read'
      ? book.finished_at
      : book.status === 'dnf'
      ? book.dnf_at
      : book.status === 'reading'
      ? book.started_at
      : book.updated_at;

  const fallback =
    source ??
    book.updated_at ??
    book.created_at ??
    '';

  const time =
    new Date(
      fallback
    ).getTime();

  return Number.isFinite(
    time
  )
    ? time
    : 0;
}

export function sortProfileBooks<
  T extends ProfileBookLike
>(
  books: T[]
) {
  return [
    ...books,
  ].sort(
    (
      a,
      b
    ) => {
      const statusDifference =
        PROFILE_BOOK_STATUS_ORDER[
          a.status
        ] -
        PROFILE_BOOK_STATUS_ORDER[
          b.status
        ];

      if (
        statusDifference !==
        0
      ) {
        return statusDifference;
      }

      return (
        getProfileBookTime(
          b
        ) -
        getProfileBookTime(
          a
        )
      );
    }
  );
}
