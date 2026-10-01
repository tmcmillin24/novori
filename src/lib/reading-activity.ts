import {
  getLocalDateKey,
} from './reading-checkins';
import {
  supabase,
} from './supabase';

export type ReadingActivityBook = {
  userBookId: string | null;
  googleBookId: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
};

export type ReadingActivityUpdate = {
  id: string;
  body: string;
  createdAt: string;
  book:
    ReadingActivityBook | null;
};

export type ReadingJourneyActivity = {
  id: string;
  type:
    | 'finished'
    | 'dnf';
  occurredAt: string;
  book:
    ReadingActivityBook | null;
};

export type ReadingActivityDay = {
  date: string;
  checkedIn: boolean;
  checkinSource:
    | 'manual'
    | 'reading_update'
    | null;
  books:
    ReadingActivityBook[];
  readingUpdates:
    ReadingActivityUpdate[];
  journeyEvents:
    ReadingJourneyActivity[];
};

export type ReadingActivityMonth = {
  year: number;
  monthIndex: number;
  daysRead: number;
  bestStreak: number;
  booksFinished: number;
  readingUpdates: number;
  checkedDates: string[];
  days: Record<
    string,
    ReadingActivityDay
  >;
};

type UserBookRow = {
  id: string;
  google_book_id: string;
  title: string;
  authors: string[] | null;
  cover_url: string | null;
};

function requireMonth(
  year: number,
  monthIndex: number
) {
  if (
    !Number.isInteger(
      year
    ) ||
    !Number.isInteger(
      monthIndex
    ) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    throw new Error(
      'Choose a valid month.'
    );
  }
}

function dateKeyToUtcTime(
  dateKey: string
) {
  const [
    year,
    month,
    day,
  ] =
    dateKey
      .split('-')
      .map(Number);

  return Date.UTC(
    year,
    month - 1,
    day
  );
}

function getBestStreak(
  dateKeys:
    string[]
) {
  const uniqueTimes =
    Array.from(
      new Set(
        dateKeys.map(
          dateKeyToUtcTime
        )
      )
    ).sort(
      (
        a,
        b
      ) =>
        a - b
    );

  let best =
    0;

  let current =
    0;

  let previous:
    number | null =
    null;

  for (
    const time
    of uniqueTimes
  ) {
    if (
      previous !==
        null &&
      time -
        previous ===
        86400000
    ) {
      current +=
        1;
    } else {
      current =
        1;
    }

    best =
      Math.max(
        best,
        current
      );

    previous =
      time;
  }

  return best;
}

function localDateKeyFromIso(
  iso:
    string | null
) {
  if (
    !iso
  ) {
    return null;
  }

  const date =
    new Date(
      iso
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return getLocalDateKey(
    date
  );
}

function createEmptyDay(
  date:
    string
): ReadingActivityDay {
  return {
    date,
    checkedIn:
      false,
    checkinSource:
      null,
    books:
      [],
    readingUpdates:
      [],
    journeyEvents:
      [],
  };
}

function addUniqueBook(
  target:
    ReadingActivityBook[],
  book:
    ReadingActivityBook | null
) {
  if (
    !book
  ) {
    return;
  }

  const identity =
    book.userBookId ??
    book.googleBookId ??
    book.title;

  if (
    target.some(
      (
        item
      ) =>
        (
          item.userBookId ??
          item.googleBookId ??
          item.title
        ) ===
        identity
    )
  ) {
    return;
  }

  target.push(
    book
  );
}

export async function getReadingActivityMonth(
  year:
    number,
  monthIndex:
    number
): Promise<ReadingActivityMonth> {
  requireMonth(
    year,
    monthIndex
  );

  const {
    data: {
      user,
    },
    error:
      authError,
  } =
    await supabase.auth
      .getUser();

  if (
    authError
  ) {
    throw authError;
  }

  if (
    !user
  ) {
    throw new Error(
      'You must be signed in.'
    );
  }

  const monthStart =
    new Date(
      year,
      monthIndex,
      1
    );

  const nextMonth =
    new Date(
      year,
      monthIndex +
        1,
      1
    );

  const firstDateKey =
    getLocalDateKey(
      monthStart
    );

  const lastDate =
    new Date(
      year,
      monthIndex +
        1,
      0
    );

  const lastDateKey =
    getLocalDateKey(
      lastDate
    );

  const startIso =
    monthStart.toISOString();

  const endIso =
    nextMonth.toISOString();

  const [
    checkinsResult,
    updatesResult,
    finishedResult,
    dnfResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'reading_checkins'
        )
        .select(
          'id, local_date, source'
        )
        .eq(
          'user_id',
          user.id
        )
        .gte(
          'local_date',
          firstDateKey
        )
        .lte(
          'local_date',
          lastDateKey
        )
        .order(
          'local_date',
          {
            ascending:
              true,
          }
        ),

      supabase
        .from(
          'posts'
        )
        .select(
          'id, body, google_book_id, book_title, book_cover_url, book_authors, created_at'
        )
        .eq(
          'author_id',
          user.id
        )
        .eq(
          'post_type',
          'reading_update'
        )
        .gte(
          'created_at',
          startIso
        )
        .lt(
          'created_at',
          endIso
        )
        .order(
          'created_at',
          {
            ascending:
              true,
          }
        ),

      supabase
        .from(
          'reading_sessions'
        )
        .select(
          'id, user_book_id, finished_at'
        )
        .eq(
          'user_id',
          user.id
        )
        .gte(
          'finished_at',
          startIso
        )
        .lt(
          'finished_at',
          endIso
        ),

      supabase
        .from(
          'reading_sessions'
        )
        .select(
          'id, user_book_id, dnf_at'
        )
        .eq(
          'user_id',
          user.id
        )
        .gte(
          'dnf_at',
          startIso
        )
        .lt(
          'dnf_at',
          endIso
        ),
    ]);

  for (
    const result
    of [
      checkinsResult,
      updatesResult,
      finishedResult,
      dnfResult,
    ]
  ) {
    if (
      result.error
    ) {
      throw result.error;
    }
  }

  const checkins =
    checkinsResult.data ??
    [];

  const checkinIds =
    checkins.map(
      (
        row
      ) =>
        String(
          row.id
        )
    );

  const checkinBooksResult =
    checkinIds.length >
    0
      ? await supabase
          .from(
            'reading_checkin_books'
          )
          .select(
            'checkin_id, user_book_id'
          )
          .eq(
            'user_id',
            user.id
          )
          .in(
            'checkin_id',
            checkinIds
          )
      : {
          data:
            [],
          error:
            null,
        };

  if (
    checkinBooksResult.error
  ) {
    throw checkinBooksResult.error;
  }

  const sessionRows = [
    ...(
      finishedResult.data ??
      []
    ),
    ...(
      dnfResult.data ??
      []
    ),
  ];

  const userBookIds =
    Array.from(
      new Set(
        [
          ...(
            checkinBooksResult.data ??
            []
          ).map(
            (
              row
            ) =>
              String(
                row.user_book_id
              )
          ),
          ...sessionRows.map(
            (
              row
            ) =>
              String(
                row.user_book_id
              )
          ),
        ].filter(
          Boolean
        )
      )
    );

  const userBooksResult =
    userBookIds.length >
    0
      ? await supabase
          .from(
            'user_books'
          )
          .select(
            'id, google_book_id, title, authors, cover_url'
          )
          .eq(
            'user_id',
            user.id
          )
          .in(
            'id',
            userBookIds
          )
      : {
          data:
            [],
          error:
            null,
        };

  if (
    userBooksResult.error
  ) {
    throw userBooksResult.error;
  }

  const userBooks =
    (
      userBooksResult.data ??
      []
    ) as
      UserBookRow[];

  const bookByUserBookId =
    new Map<
      string,
      ReadingActivityBook
    >();

  const bookByGoogleBookId =
    new Map<
      string,
      ReadingActivityBook
    >();

  for (
    const book
    of userBooks
  ) {
    const normalized:
      ReadingActivityBook = {
        userBookId:
          String(
            book.id
          ),
        googleBookId:
          book.google_book_id
            ? String(
                book.google_book_id
              )
            : null,
        title:
          String(
            book.title ??
            'Untitled'
          ),
        authors:
          Array.isArray(
            book.authors
          )
            ? book.authors
                .map(
                  String
                )
                .filter(
                  Boolean
                )
            : [],
        coverUrl:
          book.cover_url
            ? String(
                book.cover_url
              )
            : null,
      };

    bookByUserBookId.set(
      normalized.userBookId!,
      normalized
    );

    if (
      normalized.googleBookId
    ) {
      bookByGoogleBookId.set(
        normalized.googleBookId,
        normalized
      );
    }
  }

  const days:
    Record<
      string,
      ReadingActivityDay
    > =
    {};

  function getDay(
    date:
      string
  ) {
    days[date] ??=
      createEmptyDay(
        date
      );

    return days[
      date
    ];
  }

  const dateByCheckinId =
    new Map<
      string,
      string
    >();

  for (
    const row
    of checkins
  ) {
    const date =
      String(
        row.local_date
      );

    const day =
      getDay(
        date
      );

    day.checkedIn =
      true;

    day.checkinSource =
      row.source ===
        'reading_update'
        ? 'reading_update'
        : 'manual';

    dateByCheckinId.set(
      String(
        row.id
      ),
      date
    );
  }

  for (
    const row
    of (
      checkinBooksResult.data ??
      []
    )
  ) {
    const date =
      dateByCheckinId.get(
        String(
          row.checkin_id
        )
      );

    if (
      !date
    ) {
      continue;
    }

    addUniqueBook(
      getDay(
        date
      ).books,
      bookByUserBookId.get(
        String(
          row.user_book_id
        )
      ) ??
      null
    );
  }

  for (
    const row
    of (
      updatesResult.data ??
      []
    )
  ) {
    const date =
      localDateKeyFromIso(
        row.created_at
          ? String(
              row.created_at
            )
          : null
      );

    if (
      !date ||
      date <
        firstDateKey ||
      date >
        lastDateKey
    ) {
      continue;
    }

    const googleBookId =
      row.google_book_id
        ? String(
            row.google_book_id
          )
        : null;

    const fallbackBook:
      ReadingActivityBook | null =
      googleBookId ||
      row.book_title
        ? {
            userBookId:
              null,
            googleBookId,
            title:
              String(
                row.book_title ??
                'Reading Update'
              ),
            authors:
              Array.isArray(
                row.book_authors
              )
                ? row.book_authors
                    .map(
                      String
                    )
                    .filter(
                      Boolean
                    )
                : [],
            coverUrl:
              row.book_cover_url
                ? String(
                    row.book_cover_url
                  )
                : null,
          }
        : null;

    const book =
      (
        googleBookId
          ? bookByGoogleBookId.get(
              googleBookId
            )
          : null
      ) ??
      fallbackBook;

    const day =
      getDay(
        date
      );

    addUniqueBook(
      day.books,
      book
    );

    day.readingUpdates.push({
      id:
        String(
          row.id
        ),
      body:
        String(
          row.body ??
          ''
        ),
      createdAt:
        String(
          row.created_at
        ),
      book,
    });
  }

  const journeyKeys =
    new Set<
      string
    >();

  function addJourneyEvent(
    row:
      any,
    type:
      'finished'
      | 'dnf',
    occurredAt:
      string | null
  ) {
    if (
      !occurredAt
    ) {
      return;
    }

    const identity =
      `${String(
        row.id
      )}:${type}`;

    if (
      journeyKeys.has(
        identity
      )
    ) {
      return;
    }

    const date =
      localDateKeyFromIso(
        occurredAt
      );

    if (
      !date ||
      date <
        firstDateKey ||
      date >
        lastDateKey
    ) {
      return;
    }

    journeyKeys.add(
      identity
    );

    const book =
      bookByUserBookId.get(
        String(
          row.user_book_id
        )
      ) ??
      null;

    const day =
      getDay(
        date
      );

    addUniqueBook(
      day.books,
      book
    );

    day.journeyEvents.push({
      id:
        identity,
      type,
      occurredAt,
      book,
    });
  }

  for (
    const row
    of (
      finishedResult.data ??
      []
    )
  ) {
    addJourneyEvent(
      row,
      'finished',
      row.finished_at
        ? String(
            row.finished_at
          )
        : null
    );
  }

  for (
    const row
    of (
      dnfResult.data ??
      []
    )
  ) {
    addJourneyEvent(
      row,
      'dnf',
      row.dnf_at
        ? String(
            row.dnf_at
          )
        : null
    );
  }

  const checkedDates =
    checkins.map(
      (
        row
      ) =>
        String(
          row.local_date
        )
    );

  return {
    year,
    monthIndex,
    daysRead:
      checkedDates.length,
    bestStreak:
      getBestStreak(
        checkedDates
      ),
    booksFinished:
      (
        finishedResult.data ??
        []
      ).length,
    readingUpdates:
      (
        updatesResult.data ??
        []
      ).length,
    checkedDates,
    days,
  };
}
