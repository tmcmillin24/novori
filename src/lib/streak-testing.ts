import { useEffect, useState, useSyncExternalStore } from 'react';
import { getCenteredCheckinDates, type DailyReadingCheckinState } from './reading-checkins';
import { supabase } from './supabase';

const STREAK_TEST_ACCOUNT = 'novori.acc@gmail.com';

type StreakTest = {
  userId: string;
  localDate: string;
  days: number;
  bookId: string | null;
};

// Device session only. Test check-ins never write to the reading history.
let current: StreakTest | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return current;
}

function update(next: StreakTest | null) {
  current = next;
  for (const listener of listeners) listener();
}

export function useStreakTest(localDate: string) {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setUserId(user?.email?.toLowerCase() === STREAK_TEST_ACCOUNT ? user.id : null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const test = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { userId, test: test && test.userId === userId && test.localDate === localDate ? test : null };
}

export function setTestStreak(userId: string, localDate: string, days: number | null) {
  update(days === null ? null : { userId, localDate, days, bookId: null });
}

export function getTestCheckinState(test: StreakTest): DailyReadingCheckinState {
  const checkedIn = test.bookId !== null;
  const last = checkedIn ? 3 : 2;
  const dates = getCenteredCheckinDates(new Date(`${test.localDate}T12:00:00`));
  return {
    localDate: test.localDate,
    checkedIn,
    currentStreak: test.days,
    checkedDates: dates.slice(Math.max(0, last + 1 - test.days), last + 1).map(day => day.key),
  };
}

export function setTestCheckinBook(test: StreakTest, bookId: string) {
  if (current !== test) return null;
  const next = { ...test, days: test.days + (test.bookId === null ? 1 : 0), bookId };
  update(next);
  return getTestCheckinState(next);
}
