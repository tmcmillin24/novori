import { test, expect } from '@jest/globals';
import { isEnglishBookLanguage, englishEditionIsbns } from '../supabase/functions/_shared/book-language';

test.each(['en', 'eng', 'English', 'EN-US', 'en_GB'])('recognizes verified English language %s', value => {
  expect(isEnglishBookLanguage(value)).toBe(true);
});
test.each(['es', 'spa', 'Spanish', '', undefined, 'fr', 'english/spanish'])('does not infer English from ambiguous or foreign metadata %s', value => {
  expect(isEnglishBookLanguage(value)).toBe(false);
});
test('series ISBNs select only English editions even when Spanish is first', () => {
  expect(englishEditionIsbns([
    { language: { code2: 'es' }, isbn_13: 'spanish' },
    { language: { code3: 'eng' }, isbn_13: 'english', isbn_10: 'english10' },
    { isbn_13: 'unknown' },
    { language: { language: 'English' }, isbn_13: 'english' },
  ])).toEqual(['english', 'english10']);
});
