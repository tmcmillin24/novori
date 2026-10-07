/** Fit the complete orbit (including stickers) inside the current scroll viewport. */
export function getReadingOrbitLayout({
  width, height, chromeBottom, bottomInset, tablet,
}: {
  width: number;
  height: number;
  chromeBottom: number;
  bottomInset: number;
  tablet: boolean;
}) {
  const compactHeight = height < 700;
  const availableWidth = Math.max(0, width - 40);
  const heroBudget = Math.max(0, height - chromeBottom - bottomInset - (compactHeight ? 12 : 26) - 16);
  // Tablet size follows both dimensions, rather than an iPhone-sized maximum.
  // Reserve proportional space above and below for all eight stickers.
  const size = tablet
    ? Math.max(0, Math.min(availableWidth, heroBudget / (1 + 176 / 460)))
    : Math.max(0, Math.min(availableWidth, 460, Math.max(240, heroBudget - 116)));
  const scale = tablet ? Math.min(1.5, Math.max(0.82, size / 460)) : 1;
  const decorPadding = tablet ? Math.min(88 * scale, Math.max(0, (heroBudget - size) / 2)) : Math.min(88, Math.max(58, (heroBudget - size) / 2));
  return { size, decorPadding, scale, compactHeight };
}
