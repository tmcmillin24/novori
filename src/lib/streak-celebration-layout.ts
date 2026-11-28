// Size the celebration inside the measured reading card, including split view.
export function streakCelebrationFrame(regionWidth: number, regionHeight: number, fontScale: number) {
  const horizontalInset = Math.max(12, regionWidth * .04);
  const width = Math.min(620, Math.max(0, regionWidth - horizontalInset * 2));
  const frameScale = Math.min(1.55, Math.max(.78, width / 350));
  const preferredHeight = 104 * frameScale + Math.min(20, Math.max(0, fontScale - 1) * 12);
  const height = Math.min(preferredHeight, Math.max(0, regionHeight - 16));
  return { width, height, left: (regionWidth - width) / 2, top: (regionHeight - height) / 2 };
}

export function streakCelebrationLayout(width: number, height: number, sceneWidth: number, fontScale: number) {
  const dismissSize = Math.min(56, Math.max(44, width / 10));
  const availableWidth = Math.max(0, width - dismissSize - 2);
  const availableHeight = Math.max(0, height - 2);
  const artScale = Math.min(
    1.55,
    availableHeight / (sceneWidth === 122 ? 98 : 88),
    availableWidth * .4 / sceneWidth,
    Math.max(.7, width / 350),
  );
  const textScale = Math.min(
    Math.max(1, fontScale) * Math.min(1.4, Math.max(.85, width / 360)),
    availableHeight / 68,
  );
  return {
    artScale,
    stageWidth: sceneWidth * artScale,
    stageHeight: Math.min(88 * artScale, availableHeight),
    textScale,
    copyLift: availableHeight > 80 ? 7 : 0,
    dismissSize,
  };
}
