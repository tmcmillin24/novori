const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function harness({ signedIn = true, error = null } = {}) {
  const calls = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'reader-1' } : null } }) },
    rpc: async (name, args) => { calls.push({ rpc: name, args }); return { error, data: {
      annual: { kind: 'annual', periodStart: args.annual_start, targetBooks: 24, finishedBooks: 7 },
      monthly: { kind: 'monthly', periodStart: args.monthly_start, targetBooks: 2, finishedBooks: 1 },
    } }; },
    from(table) {
      const query = {
        upsert: async (patch, options) => { calls.push({ table, patch, options }); return { error }; },
        delete: () => { calls.push({ table, delete: true }); return query; },
        eq: (key, value) => { calls.push({ key, value }); return query; },
        then: (resolve) => Promise.resolve({ error }).then(resolve),
      };
      return query;
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/reading-goals.ts'), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'America/Chicago' }) }) },
      require: (name) => { if (name === './supabase') return { supabase }; throw new Error(`Goals must not load cover/provider code: ${name}`); } });
  return { api: exports, calls };
}

test('both private goal counts use one RPC with the phone time zone and no book metadata queries', async () => {
  const h = harness();
  const data = await h.api.getReadingGoalsProgress('2026-01-01', '2026-10-01');
  expect(data.annual.finishedBooks).toBe(7);
  expect(h.calls).toEqual([{ rpc: 'get_reading_goal_progress', args: {
    annual_start: '2026-01-01', monthly_start: '2026-10-01', reader_timezone: 'America/Chicago',
  } }]);
});

test('annual and monthly targets are saved as separate period-scoped settings', async () => {
  const h = harness();
  await h.api.saveReadingGoal('annual', '2026-01-01', 24);
  await h.api.saveReadingGoal('monthly', '2026-10-01', 3);
  expect(h.calls.map((call) => call.patch)).toEqual([
    { user_id: 'reader-1', goal_kind: 'annual', period_start: '2026-01-01', target_books: 24 },
    { user_id: 'reader-1', goal_kind: 'monthly', period_start: '2026-10-01', target_books: 3 },
  ]);
  expect(h.calls[0].options.onConflict).toBe('user_id,goal_kind,period_start');
});

test('removing a goal deletes only its own target, never reading history or the other goal', async () => {
  const h = harness();
  await h.api.removeReadingGoal('monthly', '2026-10-01');
  expect(h.calls).toEqual([{ table: 'reading_goals', delete: true },
    { key: 'user_id', value: 'reader-1' }, { key: 'goal_kind', value: 'monthly' }, { key: 'period_start', value: '2026-10-01' }]);
});

test.each([0, -1, 1.5, 10001, NaN, Infinity])('target %s is rejected before any write', async (target) => {
  const h = harness();
  await expect(h.api.saveReadingGoal('annual', '2026-01-01', target)).rejects.toThrow('whole number');
  expect(h.calls).toEqual([]);
});

test.each(['', '0', '-1', '2.5', '10001', '3books', '1e2', 'Infinity'])('invalid input %s cannot become a goal', (value) => {
  expect(harness().api.parseGoalTarget(value)).toBeNull();
});

test.each([[' 24 ', 24], ['1', 1], ['10000', 10000]])('whole-number input %s becomes %s books', (value, expected) => {
  expect(harness().api.parseGoalTarget(value)).toBe(expected);
});

test.each([['annual', '2026-02-01'], ['monthly', '2026-10-02'], ['monthly', '2026-13-01'], ['monthly', '1969-12-01'], ['other', '2026-01-01']])(
  'invalid %s period %s cannot be saved or removed', async (kind, period) => {
    const h = harness();
    await expect(h.api.saveReadingGoal(kind, period, 4)).rejects.toThrow();
    await expect(h.api.removeReadingGoal(kind, period)).rejects.toThrow();
    expect(h.calls).toEqual([]);
  });

test('calendar navigation handles December, January, leap years, and period limits', () => {
  const api = harness().api;
  expect(api.getGoalPeriodStart('annual', new Date(2028, 1, 29))).toBe('2028-01-01');
  expect(api.getGoalPeriodStart('monthly', new Date(2028, 1, 29))).toBe('2028-02-01');
  expect(api.shiftGoalPeriod('monthly', '2026-12-01', 1)).toBe('2027-01-01');
  expect(api.shiftGoalPeriod('monthly', '2026-01-01', -1)).toBe('2025-12-01');
  expect(api.shiftGoalPeriod('annual', '2026-01-01', 1)).toBe('2027-01-01');
  expect(api.shiftGoalPeriod('monthly', '1970-01-01', -1)).toBe('1970-01-01');
  expect(api.shiftGoalPeriod('annual', '9998-01-01', 1)).toBe('9998-01-01');
});

test('over-target progress stays complete without negative remaining books or an overflowing bar', () => {
  const api = harness().api;
  expect(api.getGoalProgressDisplay({ targetBooks: 2, finishedBooks: 3 })).toEqual({ complete: true, remaining: 0, fraction: 1 });
  expect(api.getGoalProgressDisplay({ targetBooks: 4, finishedBooks: 1 })).toEqual({ complete: false, remaining: 3, fraction: 0.25 });
  expect(api.getGoalProgressDisplay({ targetBooks: null, finishedBooks: 3 })).toEqual({ complete: false, remaining: null, fraction: 0 });
});

test('signed-out readers cannot fetch, save, or remove goals', async () => {
  const h = harness({ signedIn: false });
  await expect(h.api.getReadingGoalsProgress('2026-01-01', '2026-10-01')).rejects.toThrow('Sign in');
  await expect(h.api.saveReadingGoal('annual', '2026-01-01', 24)).rejects.toThrow('Sign in');
  await expect(h.api.removeReadingGoal('monthly', '2026-10-01')).rejects.toThrow('Sign in');
  expect(h.calls).toEqual([]);
});

test('server failures propagate instead of displaying successful saves or zero progress', async () => {
  const h = harness({ error: { message: 'unavailable' } });
  await expect(h.api.getReadingGoalsProgress('2026-01-01', '2026-10-01')).rejects.toMatchObject({ message: 'unavailable' });
  await expect(h.api.saveReadingGoal('annual', '2026-01-01', 24)).rejects.toMatchObject({ message: 'unavailable' });
  await expect(h.api.removeReadingGoal('monthly', '2026-10-01')).rejects.toMatchObject({ message: 'unavailable' });
});
