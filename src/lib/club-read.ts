import type { ClubEventBook } from './club-event';

export type ClubReadStatus = 'current' | 'upcoming' | 'past';
export type ClubRead = {
  id: string; club_id: string; book: ClubEventBook; status: ClubReadStatus;
  started_on: string | null; ended_on: string | null; note: string;
  created_by: string | null; created_at: string; updated_at: string;
};
export type ClubReadInput = Pick<ClubRead,'book'|'status'|'started_on'|'ended_on'|'note'>;
export type ClubReads = { current: ClubRead | null; upcoming: ClubRead[]; past: ClubRead[]; upcoming_more: boolean; past_more: boolean };
export function isClubReadDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value && Number(value.slice(0,4)) >= 1900;
}
export function validateClubRead(input: ClubReadInput): ClubReadInput {
  if (!input.book?.googleBookId || !input.book.title?.trim() || !Array.isArray(input.book.authors)) throw Error('Choose a book for your club.');
  if (!['current','upcoming','past'].includes(input.status)) throw Error('Choose where this book belongs.');
  if ((input.started_on && !isClubReadDate(input.started_on)) || (input.ended_on && !isClubReadDate(input.ended_on))) throw Error('Choose a valid reading date.');
  if (input.started_on && input.ended_on && input.ended_on < input.started_on) throw Error('The end date must be on or after the start date.');
  if (input.note.trim().length > 1000) throw Error('Your club note can be up to 1,000 characters.');
  return {...input,note:input.note.trim(),started_on:input.started_on||null,ended_on:input.ended_on||null};
}
export function parseClubRead(value: unknown): ClubRead | null {
  const row = value as ClubRead | null;
  return row && typeof row.id === 'string' && typeof row.club_id === 'string' && ['current','upcoming','past'].includes(row.status)
    && typeof row.book?.googleBookId === 'string' && typeof row.book.title === 'string' && Array.isArray(row.book.authors) ? row : null;
}
export function formatClubReadDates(read: Pick<ClubRead,'started_on'|'ended_on'>) {
  // Reading dates are calendar days, not instants: never shift them by time zone.
  const format = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  if (read.started_on && read.ended_on) return `${format(read.started_on)} – ${format(read.ended_on)}`;
  return read.started_on ? `Start: ${format(read.started_on)}` : read.ended_on ? `End: ${format(read.ended_on)}` : '';
}
