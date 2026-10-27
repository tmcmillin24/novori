import { amazonBookSearchUrl } from '../src/lib/amazon-book-link';
test('uses title and author even when a regional ISBN exists, so Amazon can find other print editions', () => {
  const url = new URL(amazonBookSearchUrl({ isbn:'9780241714331', title:'Alchemised', authors:['SenLinYu'] }));
  expect(url.origin).toBe('https://www.amazon.com'); expect(url.searchParams.get('k')).toBe('Alchemised SenLinYu'); expect(url.searchParams.get('i')).toBe('stripbooks');
});
test('escapes title/author punctuation and uses ISBN only if the title/author are missing', () => {
  expect(new URL(amazonBookSearchUrl({title:'A & B?',authors:['An Author']})).searchParams.get('k')).toBe('A & B? An Author');
  expect(new URL(amazonBookSearchUrl({title:'',isbn:'978-0-593-97271-7'})).searchParams.get('k')).toBe('9780593972717');
});
