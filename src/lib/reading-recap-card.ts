import { parseReadingInsights, type ReadingInsights } from './reading-insights';
export type ReadingRecapKind = 'week' | 'month' | 'year';
export type ReadingRecapSnapshot = {
  schemaVersion: 1; kind: ReadingRecapKind; periodStart: string; periodEndExclusive: string; throughDate: string;
  finishedBooks: number; daysRead: number; bestStreak: number;
  insights?: ReadingInsights;
  books: { googleBookId: string | null; isbn: string | null; title: string; coverUrl: string | null }[];
};

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return year >= 1970 && year <= 9999 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
function key(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function getRecapSharePeriod(kind: ReadingRecapKind, reference: Date): string {
  const date = new Date(reference.getFullYear(), kind === 'year' ? 0 : reference.getMonth(), kind === 'week' ? reference.getDate() : 1, 12);
  if (kind === 'week') date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return key(date);
}
export function isRecapSharePeriod(kind: unknown, start: unknown): boolean {
  const date = parseDate(start);
  return Boolean(date && (kind === 'week' || kind === 'month' || kind === 'year') && getRecapSharePeriod(kind, date) === start);
}
export function parseReadingRecapSnapshot(value: unknown): ReadingRecapSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as ReadingRecapSnapshot;
  if (item.schemaVersion !== 1 || !isRecapSharePeriod(item.kind, item.periodStart)) return null;
  const start = parseDate(item.periodStart)!;
  const end = new Date(start);
  if (item.kind === 'week') end.setDate(end.getDate() + 7);
  else if (item.kind === 'month') end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  if (item.periodEndExclusive !== key(end) || !parseDate(item.throughDate) || item.throughDate < item.periodStart || item.throughDate >= item.periodEndExclusive) return null;
  if (![item.finishedBooks,item.daysRead,item.bestStreak].every(n => Number.isSafeInteger(n) && n >= 0)
    || item.daysRead > 366 || item.bestStreak > item.daysRead || !Array.isArray(item.books)
    || item.books.length > Math.min(6,item.finishedBooks)) return null;
  if (!item.books.every(book => book && typeof book.title === 'string' && book.title.length <= 4000
    && [book.googleBookId,book.isbn,book.coverUrl].every(v => v === null || (typeof v === 'string' && v.length <= 8000)))) return null;
  if (item.insights !== undefined && !parseReadingInsights(item.insights)) return null;
  return item;
}
export function getRecapCardTitle(snapshot: ReadingRecapSnapshot): string {
  const start = parseDate(snapshot.periodStart)!;
  if (snapshot.kind === 'year') return `${start.getFullYear()} in books`;
  if (snapshot.kind === 'month') return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const end = parseDate(snapshot.periodEndExclusive)!; end.setDate(end.getDate() - 1);
  return `${start.toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${end.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
}
export function getRecapSnapshotNote(snapshot: ReadingRecapSnapshot): string | null {
  const end = parseDate(snapshot.periodEndExclusive)!; end.setDate(end.getDate() - 1);
  return snapshot.throughDate < key(end) ? `So far · through ${parseDate(snapshot.throughDate)!.toLocaleDateString(undefined,{month:'short',day:'numeric'})}` : null;
}
