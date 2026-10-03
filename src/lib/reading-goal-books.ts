import type { ReadingGoalKind } from './reading-goals';
import { supabase } from './supabase';

export type ReadingGoalBook = {
  completionId: string; userBookId: string; googleBookId: string | null;
  isbn: string | null; title: string; coverUrl: string | null;
};

// Fetch only the visible completed books. Artwork selection remains in BookCoverImage.
export async function getReadingGoalBooks(kind: ReadingGoalKind, periodStart: string, offset: number, limit = 6): Promise<ReadingGoalBook[]> {
  const match = /^(\d{4})-(\d{2})-01$/.exec(periodStart);
  if ((kind !== 'annual' && kind !== 'monthly') || !match || Number(match[1]) < 1970 || Number(match[1]) > 9998
    || Number(match[2]) < 1 || Number(match[2]) > 12 || (kind === 'annual' && match[2] !== '01')) {
    throw new Error('Choose a calendar year or calendar month.');
  }
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 12) throw new Error('Choose a valid book page.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Sign in to view reading goals.');
  const { data, error } = await supabase.rpc('get_reading_goal_books', {
    goal_kind: kind, period_start: periodStart,
    reader_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    book_offset: offset, book_limit: limit,
  });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Reading goal covers are temporarily unavailable.');
  return data;
}
