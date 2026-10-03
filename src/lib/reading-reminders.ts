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

export function parseReminderTime(value: string): string | null {
  const match = /^(\d{2}):(\d{2})(?::00)?$/.exec(value.trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${match[1]}:${match[2]}:00`;
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
  const { data, error } = await supabase.from('reading_reminder_preferences')
    .select('user_id,daily_checkin,still_reading,weekly_recap,monthly_recap,reminder_time,timezone')
    .eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ?? { user_id: userId, daily_checkin: false, still_reading: false, weekly_recap: false,
    monthly_recap: false, reminder_time: '20:00:00', timezone: getDeviceTimezone() };
}

export async function updateReadingReminderPreferences(
  changes: Partial<Pick<ReadingReminderPreferences, ReadingReminderKind | 'reminder_time'>>,
): Promise<ReadingReminderPreferences> {
  const userId = await currentUserId();
  // Only explicitly changed values are written; another device's choices are preserved.
  const patch: Record<string, unknown> = { user_id: userId, timezone: getDeviceTimezone() };
  for (const key of ['daily_checkin', 'still_reading', 'weekly_recap', 'monthly_recap'] as const) {
    if (typeof changes[key] === 'boolean') patch[key] = changes[key];
  }
  if (changes.reminder_time !== undefined) {
    const time = parseReminderTime(changes.reminder_time);
    if (!time) throw new Error('Enter a time from 00:00 to 23:59.');
    patch.reminder_time = time;
  }
  const { data, error } = await supabase.from('reading_reminder_preferences')
    .upsert(patch, { onConflict: 'user_id', defaultToNull: false })
    .select('user_id,daily_checkin,still_reading,weekly_recap,monthly_recap,reminder_time,timezone').single();
  if (error) throw error;
  return data;
}
