import { createPublicBookCache } from '../src/lib/public-book-cache';
import { readSeriesEdition } from '../src/lib/series-edition-cache';

test('a verified Ashora edition can reopen after restart without another lookup', async () => {
  let value: string | null = null;
  const disk = {
    getItem: async () => value,
    setItem: async (_: string, next: string) => { value = next; },
  };
  const exact = { id: 'nv_9798195073749', volumeInfo: {
    title: 'Curse the Heart', publishedDate: '2026-06-11',
    imageLinks: { thumbnail: 'https://example.com/edition.jpg' },
  } };
  const first = createPublicBookCache(disk);
  const lookup = jest.fn(async () => exact);
  await readSeriesEdition(174588, 2608487, lookup, first);
  await first.flush();
  const restarted = createPublicBookCache(disk);
  await expect(readSeriesEdition(174588, 2608487, lookup, restarted))
    .resolves.toEqual({ value: exact, fromCache: true });
  expect(lookup).toHaveBeenCalledTimes(1);

  const missing = jest.fn(async () => null);
  await readSeriesEdition(174588, 2608488, missing, restarted);
  await readSeriesEdition(174588, 2608488, missing, restarted);
  expect(missing).toHaveBeenCalledTimes(2);
});
