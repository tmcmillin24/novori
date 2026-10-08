import { jest, beforeAll, test, expect, beforeEach } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import Screen from '../src/app/discovery-book';
import { resolveDiscoveryBook } from '../src/lib/resolve-discovery-book';
const mockRouter = { replace: jest.fn(), back: jest.fn() };
let mockPayload: string | undefined;
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ book: mockPayload }) }));
jest.mock('../src/lib/resolve-discovery-book', () => ({ resolveDiscoveryBook: jest.fn() }));
jest.mock('../src/components/BookCoverImage', () => ({ __esModule: true, default: 'BookCoverImage' }));
jest.mock('../src/context/theme-context', () => ({ useNovoriTheme: () => ({ colors: { background: '#000', text: '#fff', mutedText: '#aaa', gold: '#ca9' } }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
const resolve = resolveDiscoveryBook as jest.MockedFunction<typeof resolveDiscoveryBook>;
const row = { id: 9999, title: 'Readable Listing', authors: ['Known Author'], isbns: ['9781234567897'], coverUrl: 'https://listing/cover.jpg', releaseYear: 2026 };
beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { jest.resetAllMocks(); mockPayload = JSON.stringify(row); });
const text = (view: renderer.ReactTestRenderer) => view.root.findAllByType(Text).map(node => node.props.children).flat().join(' ');
test('listing and original art appear immediately while details resolve; unavailable details remain viewable', async () => {
  let finish!: (id: string | null) => void;
  resolve.mockImplementation(() => new Promise(done => { finish = done; }));
  let view!: renderer.ReactTestRenderer;
  await act(async () => { view = renderer.create(<Screen />); });
  expect(text(view)).toContain('Readable Listing');
  expect(view.root.findByType('BookCoverImage' as any).props).toMatchObject({ existingCoverUrl: row.coverUrl, googleBookId: null });
  expect(text(view)).toContain('Loading book details');
  await act(async () => { finish(null); });
  expect(text(view)).toContain('aren’t available yet');
  expect(mockRouter.replace).not.toHaveBeenCalled();
  await act(async () => { view.unmount(); });
});
test('verified resolution opens full details with discovery identity and clicked metadata', async () => {
  resolve.mockResolvedValue('nv_verified');
  let view!: renderer.ReactTestRenderer;
  await act(async () => { view = renderer.create(<Screen />); });
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/book/[id]', params: expect.objectContaining({ id: 'nv_verified', discoveryId: '9999', clickedTitle: row.title, clickedAuthors: JSON.stringify(row.authors), coverUrl: row.coverUrl }) });
  await act(async () => { view.unmount(); });
});
test('network failure retains the listing and retry can resolve successfully', async () => {
  resolve.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('nv_retry');
  let view!: renderer.ReactTestRenderer;
  await act(async () => { view = renderer.create(<Screen />); });
  expect(text(view)).toContain('temporarily unavailable');
  expect(text(view)).toContain(row.title);
  await act(async () => { view.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function').at(-1)!.props.onPress(); });
  expect(resolve).toHaveBeenCalledTimes(2);
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  await act(async () => { view.unmount(); });
});
test('leaving the listing cancels late navigation', async () => {
  let finish!: (id: string | null) => void;
  resolve.mockImplementation(() => new Promise(done => { finish = done; }));
  let view!: renderer.ReactTestRenderer;
  await act(async () => { view = renderer.create(<Screen />); });
  await act(async () => { view.unmount(); });
  await act(async () => { finish('late'); });
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
test('invalid listing payload provides a return path without fetching', async () => {
  mockPayload = '{bad';
  let view!: renderer.ReactTestRenderer;
  await act(async () => { view = renderer.create(<Screen />); });
  expect(text(view)).toContain('listing is unavailable');
  expect(resolve).not.toHaveBeenCalled();
  await act(async () => { view.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress(); view.unmount(); });
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test('work with many edition ISBNs remains viewable when full details cannot resolve', async () => {
  mockPayload = JSON.stringify({ ...row, isbns: Array.from({ length: 200 }, (_, i) => String(9780000000000 + i)) });
  resolve.mockResolvedValue(null);
  let view!: renderer.ReactTestRenderer;
  await act(async () => { view = renderer.create(<Screen />); });
  expect(text(view)).toContain(row.title);
  expect(text(view)).not.toContain('listing is unavailable');
  expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ isbns: expect.any(Array) }));
  expect(resolve.mock.calls[0][0].isbns).toHaveLength(100);
  await act(async () => { view.unmount(); });
});
