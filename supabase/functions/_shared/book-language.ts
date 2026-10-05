/** Require explicit English metadata; an ISBN match never proves language. */
export function isEnglishBookLanguage(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^(?:en(?:[-_][a-z]{2})?|eng|english)$/i.test(value.trim());
}

export function englishEditionIsbns(editions: any[] | undefined): string[] {
  return [...new Set((editions ?? []).filter(edition =>
    [edition.language?.code2, edition.language?.code3, edition.language?.language]
      .some(isEnglishBookLanguage)
  ).flatMap(edition => [edition.isbn_13, edition.isbn_10])
    .filter((isbn): isbn is string => typeof isbn === 'string' && Boolean(isbn.trim())))];
}
