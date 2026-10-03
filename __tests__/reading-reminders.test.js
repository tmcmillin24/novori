const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function harness({ user = { id: 'reader-1' }, row = null, error = null, rpcError = null } = {}) {
  const calls = [];
  let timezone = 'America/Chicago';
  let nextRpcError = rpcError;
  const supabase = {
    auth: { getUser: async () => ({ data: { user } }) },
    rpc: async (name, args) => {
      calls.push({ rpc: name, args });
      return { data: row ?? { user_id: user?.id, daily_checkin: true, still_reading: true,
        weekly_recap: true, monthly_recap: true, reminder_time: '18:00:00', timezone: args.device_timezone }, error: nextRpcError };
    },
    from(table) {
      calls.push({ table });
      const query = {
        select: () => query,
        eq: (key, value) => { calls.push({ key, value }); return query; },
        upsert: (value, options) => { calls.push({ value, options }); return query; },
        maybeSingle: async () => ({ data: row, error }),
        single: async () => ({ data: row, error }),
      };
      return query;
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/reading-reminders.ts'), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: timezone }) }) }, require: (name) => {
      if (name === './supabase') return { supabase };
      throw new Error(`Reminder code must not load a cover or provider module: ${name}`);
    } });
  return { api: exports, calls, setTimezone: (value) => { timezone = value; }, setRpcError: (value) => { nextRpcError = value; } };
}

test('reading reminders register defaults on at 6 PM with the phone time zone', async () => {
  const h = harness();
  const preferences = await h.api.getReadingReminderPreferences();
  expect(preferences).toMatchObject({ user_id: 'reader-1', daily_checkin: true, still_reading: true,
    weekly_recap: true, monthly_recap: true, reminder_time: '18:00:00', timezone: 'America/Chicago' });
  expect(h.calls).toEqual([{ rpc: 'sync_reading_reminder_device', args: { device_timezone: 'America/Chicago' } }]);
});

test('saving one reminder preserves the other choices and includes the current time zone', async () => {
  const h = harness({ row: { daily_checkin: true } });
  await h.api.updateReadingReminderPreferences({ daily_checkin: true });
  const patch = h.calls.find((call) => call.value && typeof call.value === 'object');
  expect(patch.value).toEqual({ user_id: 'reader-1', daily_checkin: true, timezone: 'America/Chicago' });
  expect(patch.options).toEqual({ onConflict: 'user_id', defaultToNull: false });
});

test('saving cannot send read-only timestamps or an injected user ID', async () => {
  const h = harness();
  await h.api.updateReadingReminderPreferences({ user_id: 'other', enabled_since: { daily_checkin: '1900-01-01' }, weekly_recap: true });
  const patch = h.calls.find((call) => call.value && typeof call.value === 'object').value;
  expect(patch.user_id).toBe('reader-1');
  expect(patch).not.toHaveProperty('enabled_since');
});

test('missing migration errors do not silently enable reminders or write anywhere else', async () => {
  const h = harness({ rpcError: { code: 'PGRST202', message: 'missing sync function' } });
  await expect(h.api.getReadingReminderPreferences()).rejects.toMatchObject({ code: 'PGRST202' });
  expect(h.calls.every((call) => !call.table || call.table === 'reading_reminder_preferences')).toBe(true);
});

test('foreground sync coalesces concurrent calls and avoids repeat network work in the same zone', async () => {
  const h = harness();
  await Promise.all([h.api.syncReadingReminderDevice('reader-1'), h.api.syncReadingReminderDevice('reader-1')]);
  await h.api.syncReadingReminderDevice('reader-1');
  expect(h.calls).toHaveLength(1);
  h.setTimezone('America/Los_Angeles');
  await h.api.syncReadingReminderDevice('reader-1');
  expect(h.calls).toHaveLength(2);
  expect(h.calls[1].args.device_timezone).toBe('America/Los_Angeles');
});

test('network failure retries and sign-out clears successful device registration', async () => {
  const h = harness({ rpcError: { message: 'offline' } });
  await expect(h.api.syncReadingReminderDevice('reader-1')).rejects.toMatchObject({ message: 'offline' });
  h.setRpcError(null);
  await h.api.syncReadingReminderDevice('reader-1');
  h.api.resetReadingReminderDeviceSync();
  await h.api.syncReadingReminderDevice('reader-1');
  expect(h.calls).toHaveLength(3);
});

test('time zone synchronization keeps existing disabled reminders and custom time', async () => {
  const saved = { user_id: 'reader-1', daily_checkin: false, still_reading: false,
    weekly_recap: true, monthly_recap: false, reminder_time: '21:15:00', timezone: 'America/Chicago' };
  const h = harness({ row: saved });
  expect(await h.api.getReadingReminderPreferences()).toEqual(saved);
  expect(h.calls[0].args).toEqual({ device_timezone: 'America/Chicago' });
});

test('a session change cannot mark the wrong account as successfully synced', async () => {
  const h = harness({ row: { user_id: 'different-reader' } });
  await expect(h.api.syncReadingReminderDevice('reader-1')).rejects.toThrow('synchronize');
  await expect(h.api.syncReadingReminderDevice('reader-1')).rejects.toThrow('synchronize');
  expect(h.calls).toHaveLength(2);
});

test('signed-out readers cannot read or write reminder preferences', async () => {
  const h = harness({ user: null });
  await expect(h.api.getReadingReminderPreferences()).rejects.toThrow('Sign in');
  await expect(h.api.updateReadingReminderPreferences({ daily_checkin: true })).rejects.toThrow('Sign in');
  expect(h.calls).toEqual([]);
});

test.each(['24:00', '23:60', '9:00', '20:00:01', '20:00junk', ''])('invalid reminder time %s cannot be saved', async (time) => {
  const h = harness();
  await expect(h.api.updateReadingReminderPreferences({ reminder_time: time })).rejects.toThrow('Enter a time');
  expect(h.calls).toEqual([]);
});

test.each(['00:00', '23:59', '20:00:00'])('valid reminder time %s is normalized', async (time) => {
  const h = harness();
  await h.api.updateReadingReminderPreferences({ reminder_time: time });
  expect(h.calls.find((call) => typeof call.value === 'object').value.reminder_time).toBe(`${time.slice(0,5)}:00`);
});

const reminder = (kind, reference_date = '2026-09-30') => ({ type: 'system', entity_type: 'reading_reminder',
  metadata: { reading_reminder_kind: kind, reference_date, google_book_id: 'never-open-provider-detail' } });

test('habit reminders open the reader’s own private profile without Google book resolution', () => {
  const h = harness();
  for (const kind of ['daily_checkin', 'still_reading']) {
    expect(h.api.getReadingReminderDestination(reminder(kind))).toEqual({ pathname: '/(tabs)/profile' });
  }
  expect(h.calls).toEqual([]);
});

test.each([['weekly_recap', 'week'], ['monthly_recap', 'month']])('%s opens the completed period in Recaps', (kind, mode) => {
  const h = harness();
  expect(h.api.getReadingReminderDestination(reminder(kind))).toEqual({ pathname: '/reading-recaps', params: { mode, referenceDate: '2026-09-30' } });
});

test('other notification types keep their original routes and invalid dates fall back to private profile', () => {
  const h = harness();
  expect(h.api.getReadingReminderDestination({ ...reminder('daily_checkin'), type: 'reading_started' })).toBeNull();
  expect(h.api.getReadingReminderDestination(reminder('unknown'))).toBeNull();
  for (const value of ['2026-02-30', '2026-13-01', '/reader/other', ['2026-09-30']]) {
    expect(h.api.getReadingReminderDestination(reminder('monthly_recap', value))).toEqual({ pathname: '/(tabs)/profile' });
  }
  expect(h.api.parseRecapReferenceDate('2028-02-29').getDate()).toBe(29);
});
