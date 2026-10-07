/** Sizes use the current window, including iPad rotation and split windows. */
export function getBookLayout(width: number) {
  const tablet = width >= 768;
  const releaseCoverWidth = tablet ? Math.min(190, Math.max(150, Math.round(width * 0.15))) : 112;
  return {
    libraryColumns: tablet ? Math.min(6, Math.max(3, Math.floor((width - 40) / 190))) : 2,
    searchCoverWidth: tablet ? Math.min(144, Math.max(100, Math.round(width * 0.11))) : 75,
    trendingCoverWidth: releaseCoverWidth,
    releaseCoverWidth,
  };
}

export function getProfileBookWidth(windowWidth: number): number | '31%' {
  return windowWidth >= 768 ? Math.floor((windowWidth - 40 - 3 * 8) / 4) : '31%';
}

export function getLibraryBookWidth(windowWidth: number) {
  const columns = getBookLayout(windowWidth).libraryColumns;
  return Math.floor((windowWidth - 40 - (columns - 1) * 8) / columns);
}
