import { supabase } from './supabase';

export type ReadingReminderKind = 'daily_checkin' | 'still_reading' | 'weekly_recap' | 'monthly_recap';
export type ReadingReminderPreferences = Record<ReadingReminderKind, boolean> & {
  user_id: string;
  reminder_time: string;
  timezone: string;
};

export function getDeviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function parseRecapReferenceDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function getReadingReminderKind(item: { type: string; entity_type: string | null; metadata: Record<string, unknown> }) {
  if (item.type !== 'system' || item.entity_type !== 'reading_reminder') return null;
  const kind = item.metadata?.reading_reminder_kind;
  return kind === 'daily_checkin' || kind === 'still_reading' || kind === 'weekly_recap' || kind === 'monthly_recap'
    ? kind : null;
}

export function getReadingReminderDestination(item: Parameters<typeof getReadingReminderKind>[0]) {
  const kind = getReadingReminderKind(item);
  if (!kind) return null;
  if (kind === 'weekly_recap' || kind === 'monthly_recap') {
    const referenceDate = item.metadata.reference_date;
    if (parseRecapReferenceDate(referenceDate)) {
      return { pathname: '/reading-recaps' as const, params: {
        mode: kind === 'weekly_recap' ? 'week' : 'month', referenceDate: referenceDate as string,
      } };
    }
  }
  return { pathname: '/(tabs)/profile' as const };
}

async function currentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Sign in to manage reading reminders.');
  return user.id;
}

export async function getReadingReminderPreferences(): Promise<ReadingReminderPreferences> {
  const userId = await currentUserId();
  return registerReadingReminderDevice(userId, getDeviceTimezone());
}

async function registerReadingReminderDevice(userId: string, timezone: string): Promise<ReadingReminderPreferences> {
  const { data, error } = await supabase.rpc('sync_reading_reminder_device', { device_timezone: timezone });
  if (error) throw error;
  if (!data || data.user_id !== userId) throw new Error('Could not synchronize reading reminders. Please try again.');
  return data;
}

// Only this reminder registration is memoized. Book and provider caching is untouched.
// Foreground checks do no network work when this reader and time zone were already synced.
const syncedDeviceZones = new Map<string, string>();
const deviceSyncs = new Map<string, Promise<void>>();

export function syncReadingReminderDevice(userId: string): Promise<void> {
  const timezone = getDeviceTimezone();
  if (syncedDeviceZones.get(userId) === timezone) return Promise.resolve();
  const key = `${userId}:${timezone}`;
  const pending = deviceSyncs.get(key);
  if (pending) return pending;
  const sync = registerReadingReminderDevice(userId, timezone).then(() => {
    syncedDeviceZones.set(userId, timezone);
  }).finally(() => { deviceSyncs.delete(key); });
  deviceSyncs.set(key, sync);
  return sync;
}

export function resetReadingReminderDeviceSync() {
  syncedDeviceZones.clear();
}

export async function updateReadingReminderPreferences(
  changes: Partial<Pick<ReadingReminderPreferences, ReadingReminderKind>>,
): Promise<ReadingReminderPreferences> {
  const userId = await currentUserId();
  // Only explicitly changed values are written; another device's choices are preserved.
  const patch: Record<string, unknown> = { user_id: userId, timezone: getDeviceTimezone() };
  for (const key of ['daily_checkin', 'still_reading', 'weekly_recap', 'monthly_recap'] as const) {
    if (typeof changes[key] === 'boolean') patch[key] = changes[key];
  }
  const { data, error } = await supabase.from('reading_reminder_preferences')
    .upsert(patch, { onConflict: 'user_id', defaultToNull: false })
    .select('user_id,daily_checkin,still_reading,weekly_recap,monthly_recap,reminder_time,timezone').single();
  if (error) throw error;
  return data;
}
