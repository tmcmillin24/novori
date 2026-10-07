export type ReadingInsights = {
  finishedBookPages?: number; finishedBooksWithPageCounts?: number;
  pagesTracked?: number; authorsRead?: number; rereads?: number; audiobookJourneys?: number;
  audioProgressSeconds?: number; seriesRead?: number; seriesCaughtUp?: number;
  seriesProgress?: { id: string; name: string; finishedBooks: number; totalBooks: number }[];
};

type InsightStat = Exclude<keyof ReadingInsights, 'finishedBooksWithPageCounts' | 'seriesProgress'>;
const labels: Record<InsightStat, string> = {
  finishedBookPages: 'pages in finished books',
  pagesTracked: 'pages tracked', authorsRead: 'authors read', rereads: 'rereads', audiobookJourneys: 'audiobook journeys',
  audioProgressSeconds: 'audio progress logged', seriesRead: 'series read', seriesCaughtUp: 'series caught up',
};

export function parseReadingInsights(value: unknown): ReadingInsights | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: ReadingInsights = {};
  for (const field of [...Object.keys(labels), 'finishedBooksWithPageCounts'] as Exclude<keyof ReadingInsights, 'seriesProgress'>[]) {
    const count = (value as ReadingInsights)[field];
    if (count === undefined) continue;
    if (!Number.isSafeInteger(count) || count! < 0) return null;
    if (count! > 0) result[field] = count;
  }
  if (Boolean(result.finishedBookPages) !== Boolean(result.finishedBooksWithPageCounts)) return null;
  if (result.audioProgressSeconds && !result.audiobookJourneys) return null;
  if ((result.seriesCaughtUp ?? 0) > (result.seriesRead ?? 0)) return null;
  if ((value as ReadingInsights).seriesProgress !== undefined) {
    const rows = (value as ReadingInsights).seriesProgress;
    if (!Array.isArray(rows) || rows.length > 6 || rows.length > (result.seriesRead ?? 0)
      || !rows.every(row => row && typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 100
        && typeof row.name === 'string' && row.name.trim().length > 0 && row.name.length <= 1000
        && Number.isSafeInteger(row.finishedBooks) && Number.isSafeInteger(row.totalBooks)
        && row.finishedBooks > 0 && row.totalBooks >= row.finishedBooks && row.totalBooks <= 5000)
      || new Set(rows.map(row => row.id)).size !== rows.length) return null;
    result.seriesProgress = rows;
  }
  return result;
}

export function formatAudioProgress(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return hours ? `${hours.toLocaleString()}h ${minutes}m ${remainder}s` : minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export function getReadingInsightStats(value?: ReadingInsights) {
  const insights = parseReadingInsights(value);
  return insights ? (Object.keys(labels) as InsightStat[])
    .filter(field => insights[field]! > 0)
    .map(field => ({ field, value: insights[field]!, label: labels[field],
      displayValue: field === 'audioProgressSeconds' ? formatAudioProgress(insights[field]!) : insights[field]!.toLocaleString() })) : [];
}
