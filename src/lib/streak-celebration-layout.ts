// Size against the actual card, so iPad split view and rotation use the
// same constraints as a compact phone. The check-in controls set its height.
export function streakCelebrationLayout(width: number, height: number, sceneWidth: number, fontScale: number) {
  const availableWidth = (width || 350) - 46; // border and dismiss target
  const availableHeight = (height || 100) - 2;
  const artScale = Math.min(1.55, availableHeight / (sceneWidth === 122 ? 98 : 88), availableWidth * .4 / sceneWidth, Math.max(.85, (width || 350) / 350));
  const textScale = Math.min(
    Math.max(1, fontScale) * Math.min(1.35, Math.max(1, (width || 350) / 400)),
    availableHeight / 68,
  );
  return {
    artScale,
    stageWidth: sceneWidth * artScale,
    stageHeight: Math.min(88 * artScale, availableHeight),
    textScale,
    copyLift: availableHeight > 80 ? 7 : 0,
  };
}
