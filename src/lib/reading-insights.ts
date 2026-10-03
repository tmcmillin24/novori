export type ReadingInsights = {
  pagesTracked?: number; authorsRead?: number; rereads?: number; audiobookJourneys?: number;
};

const labels: Record<keyof ReadingInsights, string> = {
  pagesTracked: 'pages tracked', authorsRead: 'authors read', rereads: 'rereads', audiobookJourneys: 'audiobook journeys',
};

export function parseReadingInsights(value: unknown): ReadingInsights | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: ReadingInsights = {};
  for (const field of Object.keys(labels) as (keyof ReadingInsights)[]) {
    const count = (value as ReadingInsights)[field];
    if (count === undefined) continue;
    if (!Number.isSafeInteger(count) || count! < 0) return null;
    if (count! > 0) result[field] = count;
  }
  return result;
}

export function getReadingInsightStats(value?: ReadingInsights) {
  const insights = parseReadingInsights(value);
  return insights ? (Object.keys(labels) as (keyof ReadingInsights)[])
    .filter(field => insights[field]! > 0)
    .map(field => ({ field, value: insights[field]!, label: labels[field] })) : [];
}
