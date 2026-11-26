export const LIBRARY_COLUMN_OPTIONS = [2, 3, 4] as const;
export type LibraryColumns = (typeof LIBRARY_COLUMN_OPTIONS)[number];

/** Sizes use the current window, including iPad rotation and split windows. */
export function getBookLayout(width: number) {
  const tablet = width >= 768;
  const libraryColumns: LibraryColumns = tablet ? (width >= 800 ? 4 : 3) : 2;
  const releaseCoverWidth = tablet ? Math.min(190, Math.max(150, Math.round(width * 0.15))) : 112;
  return {
    libraryColumns,
    searchCoverWidth: tablet ? Math.min(144, Math.max(100, Math.round(width * 0.11))) : 75,
    trendingCoverWidth: releaseCoverWidth,
    releaseCoverWidth,
  };
}

export function getProfileBookWidth(windowWidth: number): number | '31%' {
  return windowWidth >= 768 ? Math.floor((windowWidth - 40 - 3 * 8) / 4) : '31%';
}

export function getLibraryBookWidth(windowWidth: number, columns = getBookLayout(windowWidth).libraryColumns) {
  return Math.floor((windowWidth - 40 - (columns - 1) * 8) / columns);
}
