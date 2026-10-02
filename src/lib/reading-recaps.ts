import {
  ReadingActivityBook,
} from './reading-activity';
import {
  supabase,
} from './supabase';

export type ReadingRecapJourneyEvent = {
  id:
    string;
  type:
    | 'started'
    | 'finished';
  occurredAt:
    string;
  book:
    ReadingActivityBook;
};

export type ReadingRecapJourney = {
  id:
    string;
  startedAt:
    string | null;
  finishedAt:
    string | null;
  dnfAt:
    string | null;
  book:
    ReadingActivityBook;
};

export type ReadingRecapJourneyData = {
  events:
    ReadingRecapJourneyEvent[];
  continuing:
    ReadingRecapJourney[];
};

type SessionRow = {
  id:
    string;
  user_book_id:
    string;
  started_at:
    string | null;
  finished_at:
    string | null;
  dnf_at:
    string | null;
};

type UserBookRow = {
  id:
    string;
  google_book_id:
    string | null;
  title:
    string | null;
  authors:
    string[] | null;
  cover_url:
    string | null;
};

function normalizeBook(
  row:
    UserBookRow
): ReadingActivityBook {
  return {
    userBookId:
      String(
        row.id
      ),
    googleBookId:
      row.google_book_id
        ? String(
            row.google_book_id
          )
        : null,
    title:
      String(
        row.title ??
          'Untitled'
      ),
    authors:
      Array.isArray(
        row.authors
      )
        ? row.authors
            .map(
              String
            )
            .filter(
              Boolean
            )
        : [],
    coverUrl:
      row.cover_url
        ? String(
            row.cover_url
          )
        : null,
  };
}

function isInRange(
  value:
    string | null,
  startMs:
    number,
  endMs:
    number
) {
  if (
    !value
  ) {
    return false;
  }

  const time =
    new Date(
      value
    ).getTime();

  return (
    Number.isFinite(
      time
    ) &&
    time >=
      startMs &&
    time <
      endMs
  );
}

export async function getReadingRecapJourneyData(
  start:
    Date,
  endExclusive:
    Date
): Promise<ReadingRecapJourneyData> {
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

  const startIso =
    start.toISOString();

  const endIso =
    endExclusive.toISOString();

  const {
    data:
      sessionData,
    error:
      sessionError,
  } =
    await supabase
      .from(
        'reading_sessions'
      )
      .select(
        'id, user_book_id, started_at, finished_at, dnf_at'
      )
      .eq(
        'user_id',
        user.id
      )
      .lt(
        'started_at',
        endIso
      )
      .order(
        'started_at',
        {
          ascending:
            true,
        }
      );

  if (
    sessionError
  ) {
    throw sessionError;
  }

  const sessions =
    (
      sessionData ??
      []
    ) as
      SessionRow[];

  const relevantSessions =
    sessions.filter(
      (
        session
      ) => {
        const started =
          session.started_at
            ? new Date(
                session.started_at
              ).getTime()
            : Number.NaN;

        if (
          !Number.isFinite(
            started
          ) ||
          started >=
            endExclusive.getTime()
        ) {
          return false;
        }

        const finished =
          session.finished_at
            ? new Date(
                session.finished_at
              ).getTime()
            : null;

        const dnf =
          session.dnf_at
            ? new Date(
                session.dnf_at
              ).getTime()
            : null;

        const ended =
          finished ??
          dnf;

        return (
          ended ===
            null ||
          ended >=
            start.getTime()
        );
      }
    );

  const userBookIds =
    Array.from(
      new Set(
        relevantSessions
          .map(
            (
              session
            ) =>
              String(
                session.user_book_id
              )
          )
          .filter(
            Boolean
          )
      )
    );

  if (
    userBookIds.length ===
    0
  ) {
    return {
      events:
        [],
      continuing:
        [],
    };
  }

  const {
    data:
      bookData,
    error:
      bookError,
  } =
    await supabase
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
      );

  if (
    bookError
  ) {
    throw bookError;
  }

  const booksById =
    new Map<
      string,
      ReadingActivityBook
    >(
      (
        (
          bookData ??
          []
        ) as
          UserBookRow[]
      ).map(
        (
          book
        ) => [
          String(
            book.id
          ),
          normalizeBook(
            book
          ),
        ]
      )
    );

  const startMs =
    start.getTime();

  const endMs =
    endExclusive.getTime();

  const events:
    ReadingRecapJourneyEvent[] =
    [];

  const continuing:
    ReadingRecapJourney[] =
    [];

  for (
    const session
    of relevantSessions
  ) {
    const book =
      booksById.get(
        String(
          session.user_book_id
        )
      );

    if (
      !book
    ) {
      continue;
    }

    if (
      isInRange(
        session.started_at,
        startMs,
        endMs
      )
    ) {
      events.push({
        id:
          `${session.id}:started`,
        type:
          'started',
        occurredAt:
          session.started_at!,
        book,
      });
    }

    if (
      isInRange(
        session.finished_at,
        startMs,
        endMs
      )
    ) {
      events.push({
        id:
          `${session.id}:finished`,
        type:
          'finished',
        occurredAt:
          session.finished_at!,
        book,
      });
    }

    const finishedTime =
      session.finished_at
        ? new Date(
            session.finished_at
          ).getTime()
        : null;

    const dnfTime =
      session.dnf_at
        ? new Date(
            session.dnf_at
          ).getTime()
        : null;

    const endedBeforePeriodEnd =
      (
        finishedTime !==
          null &&
        finishedTime <
          endMs
      ) ||
      (
        dnfTime !==
          null &&
        dnfTime <
          endMs
      );

    if (
      !endedBeforePeriodEnd
    ) {
      continuing.push({
        id:
          String(
            session.id
          ),
        startedAt:
          session.started_at,
        finishedAt:
          session.finished_at,
        dnfAt:
          session.dnf_at,
        book,
      });
    }
  }

  events.sort(
    (
      a,
      b
    ) =>
      new Date(
        a.occurredAt
      ).getTime() -
      new Date(
        b.occurredAt
      ).getTime()
  );

  return {
    events,
    continuing,
  };
}
