export const STREAK_TIERS = [
  { days: 3, label: 'Heating Up', sparks: 5 },
  { days: 7, label: 'On Fire', sparks: 8 },
  { days: 14, label: 'Blazing', sparks: 11 },
  { days: 30, label: 'Unstoppable', sparks: 14 },
] as const;

export type StreakTier = typeof STREAK_TIERS[number];

export function readingStreakTier(days: number): StreakTier | undefined {
  return [...STREAK_TIERS].reverse().find(tier => days >= tier.days);
}

export function reachedReadingStreakTier(previous: number, current: number): StreakTier | undefined {
  const tier = readingStreakTier(current);
  return tier && previous < tier.days ? tier : undefined;
}
