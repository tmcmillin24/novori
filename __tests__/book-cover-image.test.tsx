import { jest, beforeAll, test, expect } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import BookCoverImage from '../src/components/BookCoverImage';
import { publishCatalogCovers } from '../src/lib/canonical-book-covers';

jest.mock('expo-image', () => ({ Image: 'ExpoImage' }));
jest.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });

test('detail and thumbnail render the identical original file and update together', async () => {
  publishCatalogCovers({ book: 'https://art/original-1500.jpg' });
  let view: renderer.ReactTestRenderer;
  await act(async () => {
    view = renderer.create(<>
      <BookCoverImage googleBookId="book" existingCoverUrl="https://old/tiny.jpg" style={{ width: 75, height: 112 }} />
      <BookCoverImage googleBookId="book" imageLinks={{ extraLarge: 'https://provider/other-art.jpg' }} style={{ width: 400, height: 600 }} />
    </>);
  });
  expect(view!.root.findAllByType('ExpoImage' as any).map(image => image.props.source.uri))
    .toEqual(['https://art/original-1500.jpg', 'https://art/original-1500.jpg']);
  await act(async () => { publishCatalogCovers({ book: 'https://art/new-original.jpg' }); });
  expect(view!.root.findAllByType('ExpoImage' as any).map(image => image.props.source.uri))
    .toEqual(['https://art/new-original.jpg', 'https://art/new-original.jpg']);
  await act(async () => { view!.unmount(); });
});

test('a failed image never switches a thumbnail to different provider artwork', async () => {
  publishCatalogCovers({ failed: 'https://locked/manual-cover.jpg' });
  const onError = jest.fn();
  let view: renderer.ReactTestRenderer;
  await act(async () => {
    view = renderer.create(<BookCoverImage googleBookId="failed" isbn="9781234567897"
      imageLinks={{ thumbnail: 'https://google/other.jpg' }} onError={onError} />);
  });
  await act(async () => { view!.root.findByType('ExpoImage' as any).props.onError({ error: 'offline' }); });
  expect(view!.root.findByType('ExpoImage' as any).props.source.uri).toBe('https://locked/manual-cover.jpg');
  expect(onError).toHaveBeenCalledTimes(1);
  await act(async () => { view!.unmount(); });
});

test('cache churn cannot blank a mounted cover or alter its original URL and image cache policy', async () => {
  publishCatalogCovers({ mounted: 'https://art/mounted-original.jpg' });
  let view: renderer.ReactTestRenderer;
  await act(async () => {
    view = renderer.create(<BookCoverImage googleBookId="mounted" existingCoverUrl="https://old/tiny.jpg" />);
  });
  await act(async () => {
    publishCatalogCovers(Object.fromEntries(Array.from({ length: 1005 }, (_, i) => [`churn${i}`, `https://art/${i}`])));
  });
  const image = view!.root.findByType('ExpoImage' as any);
  expect(image.props.source.uri).toBe('https://art/mounted-original.jpg');
  expect(image.props.cachePolicy).toBe('memory-disk');
  expect(image.props.transition).toBe(0);
  await act(async () => { view!.unmount(); });
});
