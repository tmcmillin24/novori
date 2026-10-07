import { supabase } from './supabase';

export type ReadingGoalKind = 'annual' | 'monthly';
export type ReadingGoalProgress = { kind: ReadingGoalKind; periodStart: string; targetBooks: number | null; finishedBooks: number };
export type ReadingGoalsProgress = Record<ReadingGoalKind, ReadingGoalProgress>;

export function getGoalPeriodStart(kind: ReadingGoalKind, reference = new Date()): string {
  return `${reference.getFullYear()}-${kind === 'annual' ? '01' : String(reference.getMonth() + 1).padStart(2, '0')}-01`;
}

export function shiftGoalPeriod(kind: ReadingGoalKind, periodStart: string, amount: number): string {
  const [year, month] = periodStart.split('-').map(Number);
  const date = new Date(year + (kind === 'annual' ? amount : 0), month - 1 + (kind === 'monthly' ? amount : 0), 1, 12);
  if (date.getFullYear() < 1970 || date.getFullYear() > 9998) return periodStart;
  return getGoalPeriodStart(kind, date);
}

export function parseGoalTarget(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,5}$/.test(trimmed)) return null;
  const count = Number(trimmed);
  return count >= 1 && count <= 10000 ? count : null;
}

export function getGoalProgressDisplay(goal: ReadingGoalProgress) {
  const target = goal.targetBooks;
  const complete = target !== null && goal.finishedBooks >= target;
  return { complete, remaining: target === null ? null : Math.max(0, target - goal.finishedBooks),
    fraction: target === null ? 0 : Math.min(1, goal.finishedBooks / target) };
}

function validatePeriod(kind: ReadingGoalKind, periodStart: string) {
  if (kind !== 'annual' && kind !== 'monthly') throw new Error('Choose an annual or monthly goal.');
  const match = /^(\d{4})-(\d{2})-01$/.exec(periodStart);
  if (!match || Number(match[1]) < 1970 || Number(match[1]) > 9998 || Number(match[2]) < 1
    || Number(match[2]) > 12 || (kind === 'annual' && match[2] !== '01')) {
    throw new Error('Choose a calendar year or month.');
  }
}

async function currentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Sign in to manage your reading goals.');
  return user.id;
}

export async function getReadingGoalsProgress(annualStart: string, monthlyStart: string): Promise<ReadingGoalsProgress> {
  validatePeriod('annual', annualStart); validatePeriod('monthly', monthlyStart);
  await currentUserId();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { data, error } = await supabase.rpc('get_reading_goal_progress', {
    annual_start: annualStart, monthly_start: monthlyStart, reader_timezone: timezone,
  });
  if (error) throw error;
  if (!data?.annual || !data?.monthly) throw new Error('Reading goals are temporarily unavailable. Please try again.');
  return data;
}

export async function saveReadingGoal(kind: ReadingGoalKind, periodStart: string, targetBooks: number) {
  validatePeriod(kind, periodStart);
  if (!Number.isInteger(targetBooks) || targetBooks < 1 || targetBooks > 10000) {
    throw new Error('Choose a whole number of books from 1 to 10,000.');
  }
  const userId = await currentUserId();
  const { error } = await supabase.from('reading_goals').upsert({
    user_id: userId, goal_kind: kind, period_start: periodStart, target_books: targetBooks,
  }, { onConflict: 'user_id,goal_kind,period_start' });
  if (error) throw error;
}

export async function removeReadingGoal(kind: ReadingGoalKind, periodStart: string) {
  validatePeriod(kind, periodStart);
  const userId = await currentUserId();
  const { error } = await supabase.from('reading_goals').delete()
    .eq('user_id', userId).eq('goal_kind', kind).eq('period_start', periodStart);
  if (error) throw error;
}
