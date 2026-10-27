import { mediaImageSource, getMediaAspectRatio, rememberMediaAspectRatio } from '../src/lib/media-image-cache';
const oldEnv = { ...process.env };
beforeEach(() => { process.env.EXPO_PUBLIC_SUPABASE_URL='https://project.supabase.co'; process.env.EXPO_PUBLIC_MODERATION_MEDIA_ORIGIN='https://media.novori.link'; });
afterEach(() => { process.env = { ...oldEnv }; });
test('public uploaded photos share one stable moderation URL across screens', () => {
  const direct = mediaImageSource('https://project.supabase.co/storage/v1/object/public/avatars/reader/photo-1.jpg');
  expect(direct).toEqual({ uri:'https://media.novori.link/avatars/reader/photo-1.jpg', cachePolicy:'memory-disk' });
  expect(mediaImageSource(direct.uri)).toEqual(direct);
});
test('new upload versions have different keys; signed and unknown media are not persisted', () => {
  expect(mediaImageSource('https://media.novori.link/avatars/a/new.jpg').uri).not.toBe(mediaImageSource('https://media.novori.link/avatars/a/old.jpg').uri);
  expect(mediaImageSource('https://project.supabase.co/storage/v1/object/sign/private/a.jpg?token=secret').cachePolicy).toBe('none');
  expect(mediaImageSource('https://images.isbndb.com/covers/123.jpg').cachePolicy).toBe('none');
});
test('remounted feed photos retain their aspect ratio without applying it to a replacement', () => {
  const uri='https://project.supabase.co/storage/v1/object/public/post-media/a/portrait.jpg';
  rememberMediaAspectRatio(uri,0.6);
  expect(getMediaAspectRatio('https://media.novori.link/post-media/a/portrait.jpg')).toBe(0.6);
  expect(getMediaAspectRatio('https://media.novori.link/post-media/a/new.jpg')).toBeNull();
});
