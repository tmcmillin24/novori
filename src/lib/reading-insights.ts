export type ReadingInsights = {
  finishedBookPages?: number; finishedBooksWithPageCounts?: number;
  pagesTracked?: number; authorsRead?: number; rereads?: number; audiobookJourneys?: number;
};

type InsightStat = Exclude<keyof ReadingInsights, 'finishedBooksWithPageCounts'>;
const labels: Record<InsightStat, string> = {
  finishedBookPages: 'pages in finished books',
  pagesTracked: 'pages tracked', authorsRead: 'authors read', rereads: 'rereads', audiobookJourneys: 'audiobook journeys',
};

export function parseReadingInsights(value: unknown): ReadingInsights | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: ReadingInsights = {};
  for (const field of [...Object.keys(labels), 'finishedBooksWithPageCounts'] as (keyof ReadingInsights)[]) {
    const count = (value as ReadingInsights)[field];
    if (count === undefined) continue;
    if (!Number.isSafeInteger(count) || count! < 0) return null;
    if (count! > 0) result[field] = count;
  }
  if (Boolean(result.finishedBookPages) !== Boolean(result.finishedBooksWithPageCounts)) return null;
  return result;
}

export function getReadingInsightStats(value?: ReadingInsights) {
  const insights = parseReadingInsights(value);
  return insights ? (Object.keys(labels) as InsightStat[])
    .filter(field => insights[field]! > 0)
    .map(field => ({ field, value: insights[field]!, label: labels[field] })) : [];
}
