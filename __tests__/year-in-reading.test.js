const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
function harness({ signedIn = true, error = null, data, authError = null } = {}) {
  const calls = [];
  const supabase = { auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'reader-1' } : null }, error: authError }) },
    rpc: async (name, args) => { calls.push({ name, args }); return { data, error }; } };
  const exports = {};
  const source = fs.readFileSync(require('path').join(__dirname, '../src/lib/year-in-reading.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Number, Error, Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'America/Chicago' }) }) },
      require: name => { if (name === './supabase') return { supabase }; throw Error('Annual summaries must not call a book provider: ' + name); } });
  return { api: exports, calls };
}
const summary = { year: 2026, months: Array.from({ length: 12 }, (_, monthIndex) => ({ monthIndex, finishedBooks: 0, daysRead: 0 })) };
test('one own-account summary request uses the phone timezone without provider imports', async () => {
  const h = harness({ data: summary });
  expect(await h.api.getYearInReading(2026)).toEqual(summary);
  expect(h.calls).toEqual([{ name: 'get_year_in_reading', args: { reading_year: 2026, reader_timezone: 'America/Chicago' } }]);
});
test.each([1969, 9999, 2026.5, NaN, '2026'])('invalid year %s makes no request', async year => {
  const h = harness(); await expect(h.api.getYearInReading(year)).rejects.toThrow('calendar year'); expect(h.calls).toEqual([]);
});
test('signed-out accounts cannot request annual history', async () => {
  const h = harness({ signedIn: false }); await expect(h.api.getYearInReading(2026)).rejects.toThrow('Sign in'); expect(h.calls).toEqual([]);
});
test('authentication and read failures propagate without partial statistics', async () => {
  const h = harness({ authError: { message: 'Expired session' } }); await expect(h.api.getYearInReading(2026)).rejects.toMatchObject({ message: 'Expired session' }); expect(h.calls).toEqual([]);
  await expect(harness({ error: { message: 'Offline' } }).api.getYearInReading(2026)).rejects.toMatchObject({ message: 'Offline' });
});
test.each([null, { ...summary, year: 2025 }, { year: 2026, months: [] }])('malformed year data is rejected', async data => {
  await expect(harness({ data }).api.getYearInReading(2026)).rejects.toThrow('temporarily unavailable');
});
test('missing database setup gives a readable error', async () => {
  await expect(harness({ error: { code: 'PGRST202' } }).api.getYearInReading(2026)).rejects.toThrow('temporarily unavailable');
});
test('busiest month uses logged days with deterministic ties and no invented winner', () => {
  const { api } = harness();
  expect(api.getBusiestReadingMonth(summary.months)).toBeNull();
  const feb = { monthIndex: 1, daysRead: 4, finishedBooks: 1 };
  expect(api.getBusiestReadingMonth([{ monthIndex: 8, daysRead: 4, finishedBooks: 9 }, feb])).toEqual(feb);
});
