import { test, expect } from '@jest/globals';
import { cleanCatalogBookTitle, normalizeIsbnDbEdition } from '../supabase/functions/_shared/book-edition-metadata';

test('marketing copy becomes the plain title while the original remains traceable', () => {
 const raw = 'Onyx Storm DISCOVER THE FOLLOW-UP TO THE GLOBAL PHENOMENONS, FOURTH WING AND IRON FLAME!';
 const result = normalizeIsbnDbEdition({ source: { provider: 'isbndb' }, volumeInfo: { title: raw } });
 expect(result.volumeInfo.title).toBe('Onyx Storm');
 expect((result as any).novoriEdition.originalTitle).toBe(raw);
});
test.each(['Onyx Storm (Empyrean)', 'Onyx Storm (Engelstalige editie)', 'Onyx Storm (English edition)'])('cleans verified catalog suffix %s', title => {
 expect(cleanCatalogBookTitle(title)).toBe('Onyx Storm');
});
test.each(['Dune (Messiah)', 'The Story: A Memoir', 'Discover the World', 'Storm (A New Beginning)'])('retains actual subtitles %s', title => {
 expect(cleanCatalogBookTitle(title)).toBe(title);
});
