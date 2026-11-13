let mockDates: string[] = [];
let mockRange: Record<string, string> = {};
let mockQueryError: Error | null = null;
jest.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'reader' } }, error: null }) },
  // Reproduce a Monday summary that omits Sunday's saved check-in.
  rpc: async () => ({ data: { checked_in: true, current_streak: 2, checked_dates: ['2026-11-02'] }, error: null }),
  from: (table: string) => {
    mockRange.table = table;
    const query = {
      select: () => query,
      eq: (key: string, value: string) => { mockRange[key] = value; return query; },
      gte: (_key: string, value: string) => { mockRange.start = value; return query; },
      lte: async (_key: string, value: string) => {
        mockRange.end = value;
        return { data: mockDates.filter(date => date >= mockRange.start && date <= value).map(local_date => ({ local_date })), error: mockQueryError };
      },
    };
    return query;
  },
} }));
import { getDailyReadingCheckinState } from '../src/lib/reading-checkins';
beforeEach(() => { mockDates = []; mockRange = {}; mockQueryError = null; });
test('Monday strip includes Sunday across the month boundary, matching saved tracker dates', async () => {
  mockDates = ['2026-10-29', '2026-10-31', '2026-11-01', '2026-11-02'];
  const state = await getDailyReadingCheckinState('2026-11-02');
  expect(mockRange).toEqual({ table: 'reading_checkins', user_id: 'reader', start: '2026-10-30', end: '2026-11-05' });
  expect(state).toEqual({ localDate: '2026-11-02', checkedIn: true, currentStreak: 2, checkedDates: ['2026-10-31', '2026-11-01', '2026-11-02'] });
});
test.each([
  ['2027-01-01', '2026-12-29', '2027-01-04'],
  ['2028-03-01', '2028-02-27', '2028-03-04'],
  ['2026-11-01', '2026-10-29', '2026-11-04'],
])('visible range for %s includes year, leap-day and DST boundaries', async (today, start, end) => {
  mockDates = [start, today, end];
  expect((await getDailyReadingCheckinState(today)).checkedDates).toEqual(mockDates);
  expect(mockRange.start).toBe(start); expect(mockRange.end).toBe(end);
});
test('today uses the saved check-in date rather than a conflicting summary flag', async () => {
  mockDates = ['2026-11-01'];
  const state = await getDailyReadingCheckinState('2026-11-02');
  expect(state.checkedIn).toBe(false);
  expect(state.checkedDates).toEqual(['2026-11-01']);
});
test('failed date read rejects instead of presenting missing days as unchecked', async () => {
  mockQueryError = new Error('offline');
  await expect(getDailyReadingCheckinState('2026-11-02')).rejects.toThrow('offline');
});
