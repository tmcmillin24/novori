import type { GoogleBookSearchItem } from '../src/lib/book-search';
import { test, expect } from '@jest/globals';
import { cleanCatalogBookTitle, displayBookTitle, normalizeIsbnDbEdition } from '../supabase/functions/_shared/book-edition-metadata';
import { getBookPublication } from '../src/lib/book-publication';
import { applyBookWorkDetails } from '../src/lib/book-work-details';
import { matchesSeriesCatalogEdition } from '../supabase/functions/_shared/series-book-catalog';

test.each([
 ['A court of thorns and roses collectors edition', 'A Court of Thorns and Roses'],
 ["A court of thorns and roses (Collector’s Edition)", 'A Court of Thorns and Roses'],
 ['A Court of Mist and Fury (A Court of Thorns and Roses, 2)', 'A Court of Mist and Fury'],
 ['Dungeon crawler Carl', 'Dungeon Crawler Carl'],
 ['The eye of the bedlam bride', 'The Eye of the Bedlam Bride'],
 ['The Butcher’s Masquerade', 'The Butcher’s Masquerade'],
 ['The Dungeon Anarchist’s Cookbook', 'The Dungeon Anarchist’s Cookbook'],
 ['A Novel (An Unexpected Life)', 'A Novel (An Unexpected Life)'],
 ['The NASA Story', 'The NASA Story'],
 ['iPhone Adventures', 'iPhone Adventures'],
])('work display label: %s', (raw, expected) => {
 expect(displayBookTitle(raw)).toBe(expected);
 expect(displayBookTitle(displayBookTitle(raw))).toBe(expected);
});
test('collector metadata retains its edition identity and date while showing the original title/publication', () => {
 const edition = { id: 'collector', source: { provider: 'isbndb' }, volumeInfo: { title: 'A court of thorns and roses collectors edition', authors: ['Sarah J. Maas'], publishedDate: '2018', imageLinks: { thumbnail: 'https://original/locked' } } };
 const clean = normalizeIsbnDbEdition(edition);
 expect(clean.volumeInfo.title).toBe('A Court of Thorns and Roses');
 expect(clean.id).toBe('collector');
 expect(clean.volumeInfo.imageLinks).toBe(edition.volumeInfo.imageLinks);
 expect((clean as any).novoriEdition.originalTitle).toBe(edition.volumeInfo.title);
 expect(getBookPublication(clean, [{ title: 'A Court of Thorns and Roses', authors: ['Sarah J. Maas'], releaseDate: '2015', position: 1 }], 1)).toEqual({ date: '2015', label: 'First published', editionDate: '2018' });
});
test('work enrichment cannot restore series suffixes or replace edition date/cover/ISBN', () => {
 const edition: GoogleBookSearchItem = { id: 'saved', volumeInfo: { title: 'A Court of Mist and Fury', language: 'en', authors: ['Sarah J. Maas'], publishedDate: '2020', imageLinks: { thumbnail: 'https://saved/art' }, industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781234567897' }] } };
 const representative = { id: 'representative', novoriPublication: { title: 'A Court of Mist and Fury', authors: ['Sarah J. Maas'], releaseDate: '2016' }, volumeInfo: { ...edition.volumeInfo, title: 'A court of mist and fury (A Court of Thorns and Roses, 2)', publishedDate: '2016', imageLinks: { thumbnail: 'https://other/art' } } };
 const result = applyBookWorkDetails(edition, representative);
 expect(result.volumeInfo.title).toBe('A Court of Mist and Fury');
 expect(result.volumeInfo.publishedDate).toBe('2020');
 expect(result.volumeInfo.imageLinks).toEqual(edition.volumeInfo.imageLinks);
 expect(result.volumeInfo.industryIdentifiers).toEqual(edition.volumeInfo.industryIdentifiers);
 expect(result.novoriPublication).toMatchObject({ releaseDate: '2016' });
 expect(getBookPublication(result).date).toBe('2016');
});
test('series verification rejects unrelated cookbooks, prefix titles and wrong authors while retaining book three', () => {
 const row = { title: "The Dungeon Anarchist's Cookbook", authors: ['Matt Dinniman'] };
 const novel = { volumeInfo: { title: "The Dungeon Anarchist's Cookbook (Dungeon Crawler Carl, 3)", authors: ['Dinniman, Matt'], language: 'en' } };
 expect(matchesSeriesCatalogEdition(row, { metadata: novel })).toBe(true);
 for (const title of ['The Cookbook', "The Dungeon Anarchist's Cookbook Companion", 'Dungeon Crawler Carl']) {
  expect(matchesSeriesCatalogEdition(row, { metadata: { volumeInfo: { ...novel.volumeInfo, title } } })).toBe(false);
 }
 expect(matchesSeriesCatalogEdition(row, { metadata: { volumeInfo: { ...novel.volumeInfo, authors: ['Other Author'] } } })).toBe(false);
 expect(cleanCatalogBookTitle('The Art of Cooking')).toBe('The Art of Cooking');
});
