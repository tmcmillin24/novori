import { resolveSeriesOpening } from '../src/lib/series-book-opening';

const member = { title: 'Golden Son', authors: ['Pierce Brown'], isbns: [] };
const english = { id: 'golden-son', volumeInfo: { title: 'Golden Son', authors: ['Pierce Brown'], language: 'en' } };
const wrongAuthor = { id: 'other', volumeInfo: { ...english.volumeInfo, authors: ['Another Author'] } };
const wrongLanguage = { id: 'translation', volumeInfo: { ...english.volumeInfo, language: 'fr' } };

test('opens a verified Discover result after the series lookup fails', async () => {
  const search = jest.fn(async () => [wrongAuthor, wrongLanguage, english]);
  const resolveEdition = jest.fn(async () => { throw new Error('Edition lookup timed out'); });
  await expect(resolveSeriesOpening(member, 'Red Rising', () => undefined, resolveEdition, search)).resolves.toEqual(english);
  expect(search).toHaveBeenCalledWith('Golden Son');
});

test('searches Discover after an edition miss and rejects unrelated results', async () => {
  await expect(resolveSeriesOpening(member, 'Red Rising', () => undefined,
    async () => null, async () => [wrongAuthor, wrongLanguage])).resolves.toBeNull();
});

test('keeps a cached verified edition without querying either service', async () => {
  const resolveEdition = jest.fn(async () => null);
  const search = jest.fn(async () => [english]);
  await expect(resolveSeriesOpening(member, 'Red Rising', () => [english], resolveEdition, search)).resolves.toEqual(english);
  expect(resolveEdition).not.toHaveBeenCalled();
  expect(search).not.toHaveBeenCalled();
});

test('retains a retryable edition error when Discover cannot verify a match', async () => {
  const error = new Error('Edition lookup unavailable');
  await expect(resolveSeriesOpening(member, 'Red Rising', () => undefined,
    async () => { throw error; }, async () => [wrongAuthor])).rejects.toBe(error);
});
