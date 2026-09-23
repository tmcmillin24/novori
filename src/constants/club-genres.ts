export const CLUB_GENRES = [
  {
    key: 'fantasy',
    label: 'Fantasy',
  },
  {
    key: 'romance',
    label: 'Romance',
  },
  {
    key: 'mystery-thriller',
    label: 'Mystery & Thriller',
  },
  {
    key: 'science-fiction',
    label: 'Science Fiction',
  },
  {
    key: 'horror',
    label: 'Horror',
  },
  {
    key: 'historical',
    label: 'Historical',
  },
  {
    key: 'young-adult',
    label: 'Young Adult',
  },
  {
    key: 'nonfiction',
    label: 'Nonfiction',
  },
] as const;

export type ClubGenreKey =
  (typeof CLUB_GENRES)[number]['key'];

export function getClubGenreLabel(
  key: string
) {
  return (
    CLUB_GENRES.find(
      (genre) =>
        genre.key === key
    )?.label ??
    key
  );
}
