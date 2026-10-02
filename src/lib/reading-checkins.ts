import { supabase } from './supabase';

export type DailyReadingCheckinSource =
  | 'manual'
  | 'reading_update';

export type DailyReadingCheckinState = {
  localDate: string;
  checkedIn: boolean;
  currentStreak: number;
  checkedDates: string[];
};

function padDatePart(
  value: number
) {
  return String(
    value
  ).padStart(
    2,
    '0'
  );
}

export function getLocalDateKey(
  date =
    new Date()
) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function getLocalWeekDates(
  reference =
    new Date()
) {
  const day =
    reference.getDay();

  const mondayOffset =
    day ===
      0
      ? -6
      : 1 - day;

  const monday =
    new Date(
      reference.getFullYear(),
      reference.getMonth(),
      reference.getDate() +
        mondayOffset
    );

  return Array.from(
    {
      length:
        7,
    },
    (
      _,
      index
    ) => {
      const date =
        new Date(
          monday.getFullYear(),
          monday.getMonth(),
          monday.getDate() +
            index
        );

      return {
        key:
          getLocalDateKey(
            date
          ),
        date,
      };
    }
  );
}

export function getCenteredCheckinDates(reference = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(
      reference.getFullYear(),
      reference.getMonth(),
      reference.getDate() + index - 3
    );
    return { key: getLocalDateKey(date), date };
  });
}

function getClientTimezone() {
  try {
    return (
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      null
    );
  } catch {
    return null;
  }
}

export async function getDailyReadingCheckinBookIds(
  localDate =
    getLocalDateKey()
): Promise<string[]> {
  const {
    data: {
      user,
    },
    error:
      authError,
  } =
    await supabase.auth
      .getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    throw new Error(
      'You must be signed in.'
    );
  }

  const {
    data:
      checkin,
    error:
      checkinError,
  } =
    await supabase
      .from(
        'reading_checkins'
      )
      .select(
        'id'
      )
      .eq(
        'user_id',
        user.id
      )
      .eq(
        'local_date',
        localDate
      )
      .maybeSingle();

  if (checkinError) {
    throw checkinError;
  }

  if (!checkin?.id) {
    return [];
  }

  const {
    data:
      links,
    error:
      linksError,
  } =
    await supabase
      .from(
        'reading_checkin_books'
      )
      .select(
        'user_book_id'
      )
      .eq(
        'user_id',
        user.id
      )
      .eq(
        'checkin_id',
        checkin.id
      );

  if (linksError) {
    throw linksError;
  }

  const userBookIds =
    Array.from(
      new Set(
        (
          links ??
          []
        )
          .map(
            (
              row
            ) =>
              String(
                row.user_book_id ??
                ''
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
    return [];
  }

  const {
    data:
      books,
    error:
      booksError,
  } =
    await supabase
      .from(
        'user_books'
      )
      .select(
        'google_book_id'
      )
      .eq(
        'user_id',
        user.id
      )
      .in(
        'id',
        userBookIds
      );

  if (booksError) {
    throw booksError;
  }

  return Array.from(
    new Set(
      (
        books ??
        []
      )
        .map(
          (
            row
          ) =>
            String(
              row.google_book_id ??
              ''
            ).trim()
        )
        .filter(
          Boolean
        )
    )
  );
}

export async function getDailyReadingCheckinState(
  localDate =
    getLocalDateKey()
): Promise<DailyReadingCheckinState> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_reading_checkin_state',
      {
        target_local_date:
          localDate,
      }
    );

  if (error) {
    throw error;
  }

  const row =
    Array.isArray(
      data
    )
      ? data[0]
      : data;

  return {
    localDate,
    checkedIn:
      Boolean(
        row?.checked_in
      ),
    currentStreak:
      Number(
        row?.current_streak ??
        0
      ),
    checkedDates:
      Array.isArray(
        row?.checked_dates
      )
        ? row.checked_dates.map(
            (
              value:
                string
            ) =>
              String(
                value
              )
          )
        : [],
  };
}

export async function ensureDailyReadingCheckin(
  googleBookIds:
    string[],
  source:
    DailyReadingCheckinSource,
  localDate =
    getLocalDateKey()
): Promise<string> {
  const bookIds =
    Array.from(
      new Set(
        googleBookIds
          .map(
            (
              value
            ) =>
              value.trim()
          )
          .filter(
            Boolean
          )
      )
    );

  if (
    bookIds.length ===
    0
  ) {
    throw new Error(
      'Choose at least one book you read today.'
    );
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'ensure_daily_reading_checkin',
      {
        target_local_date:
          localDate,
        target_google_book_ids:
          bookIds,
        target_source:
          source,
        target_timezone:
          getClientTimezone(),
        target_timezone_offset_minutes:
          new Date()
            .getTimezoneOffset(),
      }
    );

  if (error) {
    throw error;
  }

  const row =
    Array.isArray(
      data
    )
      ? data[0]
      : data;

  const checkinId =
    row?.checkin_id ??
    row?.id ??
    data;

  if (
    !checkinId
  ) {
    throw new Error(
      'Novori could not save today\'s reading check-in.'
    );
  }

  return String(
    checkinId
  );
}

export async function replaceDailyReadingCheckinBooks(
  googleBookIds:
    string[],
  localDate =
    getLocalDateKey()
): Promise<void> {
  const bookIds =
    Array.from(
      new Set(
        googleBookIds
          .map(
            (
              value
            ) =>
              value.trim()
          )
          .filter(
            Boolean
          )
      )
    );

  if (
    bookIds.length ===
    0
  ) {
    throw new Error(
      'Choose at least one book you read today.'
    );
  }

  const {
    error,
  } =
    await supabase.rpc(
      'set_daily_reading_checkin_books',
      {
        target_local_date:
          localDate,
        target_google_book_ids:
          bookIds,
      }
    );

  if (error) {
    throw error;
  }
}
