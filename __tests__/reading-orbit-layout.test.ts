import { describe, test, expect } from '@jest/globals';
import { getReadingOrbitLayout } from '../src/lib/reading-orbit-layout';

describe('reading orbit viewport fit', () => {
  const devices = [
    ['mini', 744, 1133],
    ['11-inch', 834, 1194],
    ['13-inch', 1032, 1376],
  ] as const;

  test.each(devices)('%s fits portrait and landscape including sticker padding', (_, width, height) => {
    for (const [w, h] of [[width, height], [height, width]]) {
      const viewportHeight = h - 24;
      const layout = getReadingOrbitLayout({ width: w, height: viewportHeight, chromeBottom: 140, bottomInset: 20, tablet: true });
      expect(layout.size).toBeLessThanOrEqual(w - 40);
      expect(layout.size + layout.decorPadding * 2 + 140 + 20 + 26 + 16).toBeLessThanOrEqual(viewportHeight + 0.001);
      // Largest sticker at twelve/six o'clock, including its rotated wrapper.
      const stickerExtent = 80 * layout.scale + 14;
      expect(layout.decorPadding + Math.max(14, layout.size * 0.045)).toBeGreaterThanOrEqual(stickerExtent);
    }
  });

  test('large portrait orbit grows beyond the old phone cap', () => {
    const layout = getReadingOrbitLayout({ width: 1032, height: 1352, chromeBottom: 140, bottomInset: 20, tablet: true });
    expect(layout.size).toBeGreaterThan(700);
  });

  test('narrow multitasking window stays inside its container', () => {
    const layout = getReadingOrbitLayout({ width: 320, height: 1000, chromeBottom: 164, bottomInset: 20, tablet: false });
    expect(layout.size).toBe(280);
  });

  test('rotation recomputes the size from the shorter viewport height', () => {
    const portrait = getReadingOrbitLayout({ width: 744, height: 1109, chromeBottom: 140, bottomInset: 20, tablet: true });
    const landscape = getReadingOrbitLayout({ width: 1133, height: 720, chromeBottom: 140, bottomInset: 20, tablet: true });
    expect(landscape.size).toBeLessThan(portrait.size);
    expect(landscape.size).toBeGreaterThan(350);
  });
});
