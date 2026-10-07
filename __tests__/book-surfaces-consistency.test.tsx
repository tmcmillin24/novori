import { jest, beforeAll, test, expect } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import BookCoverImage from '../src/components/BookCoverImage';
import ClubReadCard from '../src/components/ClubReadCard';
import BookStackVisual from '../src/components/BookStackVisual';
import ReadingRecapPostAttachment from '../src/components/ReadingRecapPostAttachment';
import { publishCatalogCovers } from '../src/lib/canonical-book-covers';
jest.mock('expo-image', () => ({ Image: 'ExpoImage' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-reanimated', () => ({
 __esModule: true, default: { View: require('react-native').View },
 useSharedValue: (value: number) => require('react').useRef({ value }).current,
 useAnimatedStyle: (callback: () => any) => callback(), withSpring: (value: number) => value,
 LinearTransition: { springify: () => ({ damping: () => ({ stiffness: () => undefined }) }) },
}));
jest.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('../src/context/theme-context', () => ({ useNovoriTheme: () => ({ colors: { gold: '#b09050', text: '#fff', background: '#111', surface: '#222', border: '#333' } }) }));
beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });

test('saved club, stack, recap and detail surfaces adopt the same corrected cover and formatted work title', async () => {
 const old = 'https://art/en-llamas.jpg', fixed = 'https://art/catching-fire.jpg';
 const ids = ['club', 'stack', 'recap', 'detail'];
 publishCatalogCovers(Object.fromEntries(ids.map(id => [id, old])), Object.fromEntries(ids.map(id => [id, { workId: 'catching-fire' }])));
 const title = 'Catching fire (The Hunger Games, 2)';
 let view: renderer.ReactTestRenderer;
 await act(async () => {
  view = renderer.create(<>
   <ClubReadCard read={{ id: 'club-read', status: 'current', book: { googleBookId: 'club', title, authors: ['Suzanne Collins'], coverUrl: old } } as any} />
   <BookStackVisual items={[{ id: 'stack-item', google_book_id: 'stack', title, authors: ['Suzanne Collins'], cover_url: old }]} variant="feed" />
   <ReadingRecapPostAttachment snapshot={{ kind: 'week', schemaVersion: 1, periodStart: '2026-09-28', periodEndExclusive: '2026-10-05', throughDate: '2026-10-04', finishedBooks: 1, daysRead: 1, bestStreak: 1, books: [{ googleBookId: 'recap', title, coverUrl: old }] } as any} />
   <BookCoverImage googleBookId="detail" existingCoverUrl={old} />
  </>);
 });
 expect(view!.root.findAllByType('ExpoImage' as any).map(image => image.props.source.uri)).toEqual(Array(4).fill(old));
 await act(async () => {
  publishCatalogCovers({ detail: fixed }, { detail: { workId: 'catching-fire', rejectedUrls: [old] } });
 });
 expect(view!.root.findAllByType('ExpoImage' as any).map(image => image.props.source.uri)).toEqual(Array(4).fill(fixed));
 const rendered = JSON.stringify(view!.toJSON());
 expect(rendered).toContain('Catching Fire');
 // Props/accessibility can preserve source metadata; visible Text children use the work label.
 expect(view!.root.findAll(node => (node.type as any) === 'Text' && node.props.children === title)).toHaveLength(0);
 await act(async () => { view!.unmount(); });
});
