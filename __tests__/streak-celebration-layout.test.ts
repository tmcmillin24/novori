import { streakCelebrationLayout } from '../src/lib/streak-celebration-layout';

test.each([270, 320, 390, 600, 900])('streak celebration fits a %i point card', width => {
  for (const stage of [84, 92, 108, 122]) {
    for (const fontScale of [1, 2, 3]) {
      const height = width < 350 ? 88 : 118;
      const layout = streakCelebrationLayout(width, height, stage, fontScale);
      expect(width - 46 - layout.stageWidth).toBeGreaterThan(125);
      expect(layout.stageHeight).toBeLessThanOrEqual(height - 2);
      expect(layout.textScale * 68).toBeLessThanOrEqual(height);
    }
  }
});

test('a wider card can enlarge the scene without enlarging the check-in region', () => {
  const phone = streakCelebrationLayout(330, 114, 122, 1);
  const tablet = streakCelebrationLayout(700, 114, 122, 1);
  expect(tablet.stageWidth).toBeGreaterThan(phone.stageWidth);
  expect(tablet.textScale).toBeGreaterThan(phone.textScale);
});
