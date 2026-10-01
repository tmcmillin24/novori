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
