import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ScrollView, Text } from 'react-native';
import BookRoute from '../src/app/book/[id]/index';
import BookDetailLoading from '../src/components/BookDetailLoading';
import { fetchGoogleBooksJson } from '../src/lib/google-books';
import { getUserBook } from '../src/lib/user-books';
import { getBookCartItem } from '../src/lib/book-cart';
import { resolveHardcoverRating } from '../src/lib/book-search';
import { supabase } from '../src/lib/supabase';

let mockParams, view;
const mockRouter = { canGoBack: () => true, back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null }, useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams, useFocusEffect: () => {},
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-image', () => ({ Image: 'ExpoImage' }));
jest.mock('../src/components/BrowsingNavigation', () => ({ useBrowsingNavigationScroll: () => ({}) }));
jest.mock('../src/components/NovoriBottomBar', () => ({ NOVORI_TAB_BAR_HEIGHT: 60 }));
jest.mock('../src/components/FullScreenImageViewer', () => () => null);
jest.mock('../src/components/BookDetailLoading', () => jest.fn(() => null));
jest.mock('../src/components/BookArtworkReportButton', () => 'ReportButton');
jest.mock('../src/components/CartShortcut', () => () => null);
jest.mock('../src/components/RemoveBookConfirmSheet', () => () => null);
jest.mock('../src/components/ValidationWarningSheet', () => () => null);
jest.mock('../src/context/theme-context', () => ({ useNovoriTheme: () => ({ colors: { background: '#000', text: '#fff' } }) }));
jest.mock('../src/lib/google-books', () => ({ fetchGoogleBooksJson: jest.fn() }));
jest.mock('../src/lib/user-books', () => ({ getUserBook: jest.fn() }));
jest.mock('../src/lib/book-cart', () => ({ getBookCartItem: jest.fn() }));
jest.mock('../src/lib/book-search', () => ({ resolveHardcoverRating: jest.fn() }));
jest.mock('../src/lib/feed', () => ({ getCommunityBookReviews: async () => [] }));
jest.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('../src/lib/edition-page-loader', () => ({ syncEditionPages: async () => {} }));
jest.mock('../src/lib/use-user-book-updates', () => ({ useUserBookUpdates: () => {} }));
jest.mock('../src/lib/book-cart-count', () => ({ subscribeBookCartMutations: () => () => {} }));
jest.mock('../src/lib/canonical-book-covers', () => ({
  canonicalCoverKey: input => input.googleBookId,
  subscribeCanonicalBookCovers: () => () => {},
  getCanonicalBookCoverMetadata: () => null,
  getCanonicalBookCover: input => input.existingCoverUrl ?? null,
  resolveCanonicalBookCover: async input => input.existingCoverUrl ?? null,
}));
jest.mock('../src/lib/public-book-cache', () => ({
  bookExtraKey: (kind, id) => kind + id,
  publicBookCache: { peek: async () => null, read: async (_key, load) => ({ value: await load(), fromCache: false }) },
}));

const cover = 'https://images.isbndb.com/covers/edition.jpg';
const clicked = {
  id: 'nv_9781619634442', source: 'discover', clickedTitle: 'A Court of Thorns and Roses',
  clickedAuthors: '["Sarah J. Maas"]', clickedIsbn: '9781619634442', coverUrl: cover,
  clickedRating: '3.68', clickedRatingsCount: '3738',
};
const data = { id: clicked.id, volumeInfo: { title: clicked.clickedTitle, authors: ['Sarah J. Maas'],
  subtitle: 'An edition subtitle', industryIdentifiers: [{ type: 'ISBN_13', identifier: clicked.clickedIsbn }], pageCount: 432 } };
const response = { ok: true, data };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const mount = async () => { await act(async () => { view = renderer.create(<BookRoute />); }); };
const close = async () => { if (view) await act(async () => { view.unmount(); view = null; }); };
const title = () => view.root.findAllByType(Text).find(node => node.props.children === mockParams.clickedTitle);
function button(label) {
  let node = view.root.findAllByType(Text).find(t => t.props.children === label);
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  return node ?? undefined;
}
const art = () => view.root.findByType('ExpoImage');
beforeAll(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { ...clicked };
  getUserBook.mockResolvedValue(null);
  getBookCartItem.mockResolvedValue(null);
  resolveHardcoverRating.mockResolvedValue(null);
  supabase.functions.invoke.mockResolvedValue({ data: { series: null, books: [] } });
});
afterEach(close);

test('slow first open and immediate cached reopen use the real page from the first commit', async () => {
  const detail = deferred(), reader = deferred(), rating = deferred(), series = deferred();
  fetchGoogleBooksJson.mockReturnValueOnce(detail.promise).mockResolvedValue(response);
  getUserBook.mockReturnValueOnce(reader.promise);
  resolveHardcoverRating.mockReturnValueOnce(rating.promise);
  supabase.functions.invoke.mockReturnValueOnce(series.promise);
  await mount();
  const firstCover = art(), firstTitle = title(), firstScroll = view.root.findByType(ScrollView);
  const owned = button('Mark as Owned');
  expect(firstTitle).toBeDefined();
  expect(firstCover.props.source.uri).toBe(cover);
  expect(JSON.stringify(view.toJSON())).toContain('3,738 ratings');
  expect(owned.props.disabled).toBe(true);
  expect(button('Add to Cart').props.disabled).toBe(true);
  expect(view.root.findByType('ReportButton').props.bookId).toBeUndefined();
  expect(BookDetailLoading).not.toHaveBeenCalled();

  await act(async () => { detail.resolve(response); });
  expect(art()).toBe(firstCover);
  expect(title()).toBe(firstTitle);
  expect(view.root.findByType(ScrollView)).toBe(firstScroll);
  expect(button('Mark as Owned')).toBe(owned);
  expect(owned.props.disabled).toBe(true);
  expect(view.root.findByType('ReportButton').props.bookId).toBe(clicked.id);
  await act(async () => {
    reader.resolve(null); rating.resolve({ rating: 4.12, ratingsCount: 4000, googleBookId: clicked.id });
    series.resolve({ data: { series: { id: 7, name: 'ACOTAR', currentPosition: 1 }, books: [] } });
  });
  expect(art()).toBe(firstCover);
  expect(title()).toBe(firstTitle);
  expect(button('Mark as Owned')).toBe(owned);
  expect(owned.props.disabled).toBe(false);
  expect(JSON.stringify(view.toJSON())).toContain('4,000 ratings');
  expect(BookDetailLoading).not.toHaveBeenCalled();

  await close(); await mount();
  expect(title()).toBeDefined();
  expect(art().props.source.uri).toBe(cover);
  expect(BookDetailLoading).not.toHaveBeenCalled();
});

test('failed lookup retains the public page and retry fills it without remounting the cover', async () => {
  const retry = deferred();
  fetchGoogleBooksJson.mockResolvedValueOnce({ ok: false, status: 503, data: null }).mockReturnValueOnce(retry.promise);
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await mount();
    const originalCover = art();
    expect(title()).toBeDefined();
    expect(view.root.findByType('ReportButton').props.bookId).toBeUndefined();
    await act(async () => { button('Try again').props.onPress(); });
    expect(art()).toBe(originalCover);
    await act(async () => { retry.resolve(response); });
    expect(art()).toBe(originalCover);
    expect(button('Try again')).toBeUndefined();
    expect(button('Mark as Owned').props.disabled).toBe(false);
    expect(BookDetailLoading).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});

test('switching books discards late detail responses; a link without a title uses the fallback', async () => {
  const first = deferred(), second = deferred();
  fetchGoogleBooksJson.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  await mount();
  mockParams = { source: 'discover', id: 'next-book', clickedTitle: 'Dune', coverUrl: 'https://images.isbndb.com/other.jpg' };
  await act(async () => { view.update(<BookRoute />); });
  expect(title()).toBeDefined();
  await act(async () => { first.resolve(response); });
  expect(art().props.source.uri).toBe(mockParams.coverUrl);
  expect(view.root.findByType('ReportButton').props.bookId).toBeUndefined();
  expect(BookDetailLoading).not.toHaveBeenCalled();
  mockParams = { id: 'bare-link', source: 'shared' };
  fetchGoogleBooksJson.mockReturnValueOnce(deferred().promise);
  await act(async () => { view.update(<BookRoute />); });
  expect(BookDetailLoading).toHaveBeenCalled();
  expect(view.root.findAllByType('ExpoImage')).toHaveLength(0);
});
