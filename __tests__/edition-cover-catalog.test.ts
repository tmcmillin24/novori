import { editionCoverChoices } from '../supabase/functions/_shared/edition-cover-catalog';
import { matchesSeriesCatalogEdition } from '../supabase/functions/_shared/series-book-catalog';
import fixture from './fixtures/live-edition-covers.json';
const row = (id: string, url: string, author = 'Writer', language = 'en') => ({
 provider_book_id: id, provider: 'isbndb', isbn_13: id, work_id: 'work',
 metadata: { volumeInfo: { title: 'A Novel', authors: [author], language, imageLinks: { medium: url } } },
});
test('two editions retain their own cover regardless of row ordering', () => {
 const a = row('a','https://art/a.jpg'), b = row('b','https://art/b.jpg');
 expect(editionCoverChoices(a,[b,a])[0].url).toBe('https://art/a.jpg');
 expect(editionCoverChoices(b,[a,b])[0].url).toBe('https://art/b.jpg');
});
test('missing artwork only borrows a matching English book, with manual locks preserved', () => {
 const seed = row('seed','');
 const wrong = row('wrong','https://art/wrong.jpg','Other');
 const foreign = row('foreign','https://art/foreign.jpg','Writer','es');
 const valid = row('good','https://art/good.jpg');
 expect(editionCoverChoices(seed,[wrong,foreign,valid]).map(c=>c.url)).toEqual(['https://art/good.jpg']);
 expect(editionCoverChoices(seed,[valid],{url:'https://art/manual.jpg',provider:'manual'})[0]).toMatchObject({locked:true,url:'https://art/manual.jpg'});
});
test.each(fixture)('live exported artwork remains usable for $title', work => {
 const seeds = work.editions.filter(e => ['en','eng','english'].includes((e.language ?? '').toLowerCase()) && Object.keys(e.metadata.volumeInfo.imageLinks ?? {}).length);
 for (const seed of seeds) {
  const choices = editionCoverChoices(seed,work.editions);
  if (matchesSeriesCatalogEdition(seed.metadata.volumeInfo,seed)) expect(choices.length).toBeGreaterThan(0);
  else expect(choices).toEqual([]); // Foreign/mislabeled supplements remain excluded.
 }
});
test.each([
 ['Threshing Day','9781682818527'],["Harry Potter and the Philosopher's Stone",'9781781100219'],
 ['Piranesi','9781432895082'],['Scion','9781668239261'],
])('explicit cached edition for %s wins without provider calls', (title,isbn) => {
 const work=fixture.find(w=>w.title===title)!;
 const requested=work.editions.find(e=>e.isbn_13===isbn && e.provider==='isbndb')!;
 expect(requested).toBeDefined();
 const seed=work.editions.find(e=>e.language==='en')!;
 expect(editionCoverChoices(seed,work.editions)[0].bookId).toBe(requested.provider_book_id);
});
