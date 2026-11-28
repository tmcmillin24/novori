import { streakCelebrationFrame, streakCelebrationLayout } from '../src/lib/streak-celebration-layout';

test.each([270, 320, 390, 600, 900])('streak celebration fits a %i point card', width => {
  for (const stage of [84, 92, 108, 122]) {
    for (const fontScale of [1, 2, 3]) {
      const height = width < 350 ? 88 : 118;
      const layout = streakCelebrationLayout(width, height, stage, fontScale);
      expect(width - layout.dismissSize - 2 - layout.stageWidth).toBeGreaterThan(125);
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

test.each([[270, 156], [338, 176], [728, 186], [900, 210]])(
  'the celebration is centered within a %i by %i reading region',
  (width, height) => {
    for (const fontScale of [1, 2, 3]) {
      const frame = streakCelebrationFrame(width, height, fontScale);
      expect(frame.left).toBeGreaterThanOrEqual(12);
      expect(frame.top).toBeGreaterThanOrEqual(8);
      expect(frame.width).toBeLessThanOrEqual(620);
      expect(frame.left * 2 + frame.width).toBe(width);
      expect(frame.top * 2 + frame.height).toBe(height);
      for (const stage of [84, 92, 108, 122]) {
        const layout = streakCelebrationLayout(frame.width, frame.height, stage, fontScale);
        expect(frame.width - layout.dismissSize - 2 - layout.stageWidth).toBeGreaterThan(110);
        expect(layout.stageHeight).toBeLessThan(frame.height);
      }
    }
  },
);

test.each([84, 92, 108, 122])('the rendered %i point scene scales from compact iPhone to iPad', stage => {
  const compact = streakCelebrationFrame(270, 180, 1);
  const phone = streakCelebrationFrame(390, 180, 1);
  const tablet = streakCelebrationFrame(740, 180, 1);
  const compactLayout = streakCelebrationLayout(compact.width, compact.height, stage, 1);
  const phoneLayout = streakCelebrationLayout(phone.width, phone.height, stage, 1);
  const tabletLayout = streakCelebrationLayout(tablet.width, tablet.height, stage, 1);

  expect(compact.width).toBeLessThan(phone.width);
  expect(compact.height).toBeLessThan(phone.height);
  expect(compactLayout.stageWidth).toBeLessThan(phoneLayout.stageWidth);
  expect(compactLayout.textScale).toBeLessThan(phoneLayout.textScale);
  expect(tablet.width).toBeGreaterThan(phone.width);
  expect(tablet.height).toBeGreaterThan(phone.height);
  expect(tabletLayout.stageWidth).toBeGreaterThan(phoneLayout.stageWidth);
  expect(tabletLayout.textScale).toBeGreaterThan(phoneLayout.textScale);
  expect(compactLayout.dismissSize).toBeGreaterThanOrEqual(44);
});

test('wide but shallow cards bound the artwork and text by their height', () => {
  const frame = streakCelebrationFrame(700, 112, 3);
  const layout = streakCelebrationLayout(frame.width, frame.height, 122, 3);
  expect(frame.top).toBe(8);
  expect(layout.stageHeight).toBeLessThanOrEqual(frame.height - 2);
  expect(layout.textScale * 68).toBeLessThanOrEqual(frame.height - 2);
});
