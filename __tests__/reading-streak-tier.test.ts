import { reachedReadingStreakTier, readingStreakTier } from '../src/lib/reading-streak-tier';

test.each([[3,'Heating Up'],[7,'On Fire'],[14,'Blazing'],[30,'Unstoppable']])(
  'a successful check-in for day %i reaches its new tier once', (days, label) => {
    expect(reachedReadingStreakTier(days - 1, days)?.label).toBe(label);
    expect(reachedReadingStreakTier(days, days + 1)).toBeUndefined();
  },
);
test('a streak grows beyond 30 days without another tier', () => {
  expect(readingStreakTier(2)).toBeUndefined();
  expect(readingStreakTier(90)?.label).toBe('Unstoppable');
  expect(reachedReadingStreakTier(30, 90)).toBeUndefined();
});
