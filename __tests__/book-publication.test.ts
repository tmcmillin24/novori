import { test, expect } from '@jest/globals';
import { getBookPublication } from '../src/lib/book-publication';

const book = { volumeInfo: { title: 'The First Novel', authors: ['Jane Reader'], publishedDate: '2023-09-12' } };
const row = { title: 'The First Novel', authors: ['Reader, Jane'], releaseDate: '2012', position: 1 };

test('series original year wins over a newer edition without changing the stored edition', () => {
 expect(getBookPublication(book, [row], 1)).toEqual({ date: '2012', label: 'First published', editionDate: '2023-09-12' });
 expect(book.volumeInfo.publishedDate).toBe('2023-09-12');
});
test('retains original date precision and handles cleaned edition names', () => {
 expect(getBookPublication({ volumeInfo: { ...book.volumeInfo, title: 'The First Novel (Standard Edition)' } }, [{ ...row, releaseDate: '2012-05-03' }], 1).date).toBe('2012-05-03');
});
test.each([
 { ...row, title: 'The Second Novel' },
 { ...row, authors: ['Another Writer'] },
 { ...row, position: 2 },
 { ...row, releaseDate: '2012-02-30' },
 { ...row, releaseDate: '2026' },
 { ...row, releaseDate: '2023-10-01' },
])('rejects unverified or inconsistent series dates', candidate => {
 expect(getBookPublication(book, [candidate], 1)).toEqual({ date: '2023-09-12', label: 'Edition published', editionDate: '2023-09-12' });
});
test('standalone or unknown original dates retain a clearly labeled edition date', () => {
 expect(getBookPublication(book, []).label).toBe('Edition published');
 expect(getBookPublication(book, [{ ...row, releaseDate: null }], 1).date).toBe('2023-09-12');
});
test('a matching original is usable when edition metadata has no date', () => {
 expect(getBookPublication({ volumeInfo: { ...book.volumeInfo, publishedDate: undefined } }, [row], 1).date).toBe('2012');
});
test('year-only original metadata does not invent a month or day', () => {
 expect(getBookPublication(book, [{ ...row, releaseDate: '2023' }], 1).date).toBe('2023');
});
test('a collection cannot borrow the first novel release date', () => {
 expect(getBookPublication({ volumeInfo: { ...book.volumeInfo, description: 'All five books in a luxe box set.' } }, [row], 1).label).toBe('Edition published');
});
