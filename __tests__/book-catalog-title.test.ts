import { test, expect } from '@jest/globals';
import { cleanCatalogBookTitle, normalizeIsbnDbEdition, isCatalogCollection } from '../supabase/functions/_shared/book-edition-metadata';

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

test('standard edition labels and catalog source markers are cleaned for any ISBNdb book', () => {
 const result = normalizeIsbnDbEdition({ source: { provider: 'isbndb' }, volumeInfo: { title: 'Another Novel (Standard Edition)', description: 'A real publisher description.[Bokinfo]' } });
 expect(result.volumeInfo.title).toBe('Another Novel');
 expect(result.volumeInfo.description).toBe('A real publisher description.');
});


test('description-identified sets keep their actual pages and a distinct title',()=>{
 const raw={source:{provider:'isbndb'},volumeInfo:{title:'A court of thorns and roses',pageCount:3300,description:'All five of the Court of Thorns and Roses hardcovers with the new series look in a luxe box set.'}};
 const result=normalizeIsbnDbEdition(raw);
 expect(result.volumeInfo.title).toBe('A Court of Thorns and Roses (Box Set)');
 expect(result.volumeInfo.pageCount).toBe(3300);
 expect(isCatalogCollection(result)).toBe(true);
 expect(normalizeIsbnDbEdition(result)).toEqual(result);
});
test.each(['She discovers all five books in a box set hidden under her bed.', 'A collection of thirteen short stories from one author.'])('does not classify story content or a single anthology as a multi-book set: %s',description=>{
 expect(isCatalogCollection({volumeInfo:{title:'A Novel',description}})).toBe(false);
});
