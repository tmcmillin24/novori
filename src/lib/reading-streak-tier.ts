export const STREAK_TIERS = [
  { days: 3, label: 'Heating Up', color: '#F6AF64', sparks: 5 },
  { days: 7, label: 'On Fire', color: '#FF925B', sparks: 8 },
  { days: 14, label: 'Blazing', color: '#FFD07B', sparks: 11 },
  { days: 30, label: 'Unstoppable', color: '#FFE2A0', sparks: 14 },
] as const;

export type StreakTier = typeof STREAK_TIERS[number];

export function readingStreakTier(days: number): StreakTier | undefined {
  return [...STREAK_TIERS].reverse().find(tier => days >= tier.days);
}

export function reachedReadingStreakTier(previous: number, current: number): StreakTier | undefined {
  const tier = readingStreakTier(current);
  return tier && previous < tier.days ? tier : undefined;
}
