import type { ReadingInsights } from './reading-insights';
import { supabase } from './supabase';

export type ReadingYearMonth = { monthIndex: number; finishedBooks: number; daysRead: number };
export type ReadingYearSummary = {
  year: number; timezone: string; asOfDate: string;
  finishedBooks: number; daysRead: number; bestStreak: number;
  bestStreakStart: string | null; bestStreakEnd: string | null;
  annualTarget: number | null; insights?: ReadingInsights; months: ReadingYearMonth[];
};

export function getBusiestReadingMonth(months: ReadingYearMonth[]): ReadingYearMonth | null {
  // Ties belong to the earliest month; a year with no check-ins has no winner.
  return months.reduce<ReadingYearMonth | null>((best, month) => month.daysRead > 0
    && (!best || month.daysRead > best.daysRead || (month.daysRead === best.daysRead && month.monthIndex < best.monthIndex))
    ? month : best, null);
}

export async function getYearInReading(year: number): Promise<ReadingYearSummary> {
  if (!Number.isInteger(year) || year < 1970 || year > 9998) throw new Error('Choose a valid calendar year.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Sign in to view your year in reading.');
  const { data, error } = await supabase.rpc('get_year_in_reading_insights', {
    reading_year: year, reader_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('Year in Reading is temporarily unavailable. Please try again later.');
    }
    throw error;
  }
  if (data?.year !== year || !Array.isArray(data.months) || data.months.length !== 12) {
    throw new Error('Your year in reading is temporarily unavailable. Please try again.');
  }
  return data;
}
