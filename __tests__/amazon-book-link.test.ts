import { amazonBookSearchUrl } from '../src/lib/amazon-book-link';
test('uses the chosen edition ISBN without substituting title or artwork', () => {
  const url = new URL(amazonBookSearchUrl({ isbn:'978-0-593-97271-7', title:'Alchemised', authors:['SenLinYu'] }));
  expect(url.origin).toBe('https://www.amazon.com'); expect(url.searchParams.get('k')).toBe('9780593972717');
});
test('falls back to escaped title and author only when ISBN is unavailable or malformed', () => {
  const url = new URL(amazonBookSearchUrl({ isbn:'unknown', title:'A & B?', authors:['An Author'] }));
  expect(url.searchParams.get('k')).toBe('A & B? An Author');
});
