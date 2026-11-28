import {getSeriesRowMetadata, rememberSeriesRowMetadata, subscribeSeriesRowMetadata} from '../src/lib/series-row-metadata';

test('an already mounted list hears about the edition opened on another screen', () => {
  const observed = jest.fn(() => getSeriesRowMetadata(23, 31));
  const unsubscribe = subscribeSeriesRowMetadata(observed);
  expect(getSeriesRowMetadata(23, 31)).toBeUndefined();
  const edition = {bookId:'nv_9798195073749',publishedDate:'2026-06-11',imageLinks:{thumbnail:'https://example.com/cover.jpg'}};
  rememberSeriesRowMetadata(23,31,edition);
  expect(observed).toHaveLastReturnedWith(edition);
  expect(getSeriesRowMetadata(24,31)).toBeUndefined();
  rememberSeriesRowMetadata(23,31,{bookId:edition.bookId});
  expect(observed).toHaveBeenCalledTimes(1);
  unsubscribe();
});
