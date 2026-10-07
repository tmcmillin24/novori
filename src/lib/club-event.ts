export type ClubEventRsvp = 'going' | 'maybe' | 'cant_go';
export type ClubEventBook = { googleBookId: string; isbn: string | null; title: string; authors: string[]; coverUrl: string | null };
export type ClubEvent = {
  id: string; club_id: string; post_id: string; title: string; description: string;
  starts_at: string; ends_at: string; timezone: string; kind: 'in_person' | 'virtual';
  location: string | null; meeting_url: string | null; book: ClubEventBook | null;
  cancelled_at: string | null; created_by: string | null; created_at: string; updated_at: string;
  going_count?: number; maybe_count?: number; viewer_rsvp?: ClubEventRsvp | null;
};
export type ClubEventInput = Pick<ClubEvent,'title'|'description'|'starts_at'|'ends_at'|'timezone'|'kind'|'location'|'meeting_url'|'book'>;
export function parseClubEvent(value: unknown): ClubEvent | null {
  const row = (Array.isArray(value) ? value[0] : value) as ClubEvent | null;
  return row && typeof row.id === 'string' && typeof row.post_id === 'string' && typeof row.title === 'string'
    && Number.isFinite(Date.parse(row.starts_at)) && Number.isFinite(Date.parse(row.ends_at)) ? row : null;
}
export function isUpcomingClubEvent(event: ClubEvent,now = Date.now()) {
  return !event.cancelled_at && Date.parse(event.ends_at) > now;
}
export function formatClubEventTime(event: ClubEvent) {
  const start = new Date(event.starts_at), end = new Date(event.ends_at);
  const date = start.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  const options: Intl.DateTimeFormatOptions = {hour:'numeric',minute:'2-digit',timeZoneName:'short'};
  return `${date} · ${start.toLocaleTimeString(undefined,options)} – ${start.toDateString() === end.toDateString() ? '' : end.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' · '}${end.toLocaleTimeString(undefined,options)}`;
}
export function validateClubEvent(input: ClubEventInput) {
  if (input.title.trim().length < 3 || input.title.trim().length > 120) throw Error('Give your event a name between 3 and 120 characters.');
  if (input.description.trim().length > 2000) throw Error('Descriptions can be up to 2,000 characters.');
  if (!Number.isFinite(Date.parse(input.starts_at)) || !Number.isFinite(Date.parse(input.ends_at)) || Date.parse(input.ends_at) <= Date.parse(input.starts_at)) throw Error('Choose an end time after the start time.');
  if (input.kind === 'in_person' && (!input.location?.trim() || input.location.trim().length > 300)) throw Error('Add a meeting location, up to 300 characters.');
  if (input.kind === 'virtual') { try { const url = new URL(input.meeting_url ?? ''); if (!['https:','http:'].includes(url.protocol) || !url.hostname) throw Error(); } catch { throw Error('Add a valid http or https meeting link.'); } }
  return { ...input,title: input.title.trim(),description: input.description.trim(),location: input.kind === 'in_person' ? input.location!.trim() : null,meeting_url: input.kind === 'virtual' ? input.meeting_url!.trim() : null };
}
// The device's local wall clock becomes an absolute instant. Reject nonexistent
// DST times instead of silently shifting a meeting by an hour.
export function localClubEventInstant(day: string,hour: string,minute: string,pm: boolean) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!parts || !/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) throw Error('Choose a valid date and time.');
  const [year,month,date] = parts.slice(1).map(Number), h = Number(hour), m = Number(minute);
  if (h < 1 || h > 12 || m < 0 || m > 59) throw Error('Hours must be 1–12 and minutes 00–59.');
  const hours = h % 12 + (pm ? 12 : 0), value = new Date(year,month-1,date,hours,m);
  if (value.getFullYear() !== year || value.getMonth() !== month-1 || value.getDate() !== date || value.getHours() !== hours || value.getMinutes() !== m) throw Error('That time does not exist in your local time zone. Choose another time.');
  return value.toISOString();
}
export function localClubEventFields(instant: string) {
  const value = new Date(instant);
  return {day: `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`,hour:String(value.getHours()%12 || 12),minute:String(value.getMinutes()).padStart(2,'0'),pm:value.getHours() >= 12};
}
