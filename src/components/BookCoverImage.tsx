import { moderationMediaUrl } from '../lib/moderation-media-url';
import type { ImageProps } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { CanonicalCoverInput } from '../lib/canonical-book-covers';
import {
  getCanonicalBookCover,
  canonicalCoverKey,
  resolveCanonicalBookCover,
  subscribeCanonicalBookCovers,
} from '../lib/canonical-book-covers';

type Props = Omit<ImageProps, 'source'> & CanonicalCoverInput;

// Every book image renders the catalog's original URL. Display size never
// participates in selection, and image failures never switch artwork locally.
export default function BookCoverImage({
  googleBookId, isbn, isbns, imageLinks, existingCoverUrl,
  resizeMode, onError, ...imageProps
}: Props) {
  const input = { googleBookId, isbn, isbns, imageLinks, existingCoverUrl };
  const key = canonicalCoverKey(input);
  const subscribe = useCallback((listener: () => void) => subscribeCanonicalBookCovers(listener, key), [key]);
  const url = useSyncExternalStore(
    subscribe,
    () => getCanonicalBookCover(input),
    () => null,
  );
  const isbnKey = (isbns ?? []).join(',');
  useEffect(() => {
    void resolveCanonicalBookCover({ googleBookId, isbn, isbns, imageLinks, existingCoverUrl });
  }, [googleBookId, isbn, isbnKey, imageLinks, existingCoverUrl]);

  const contentFit = resizeMode === 'contain' ? 'contain' : resizeMode === 'center' ? 'none' :
    resizeMode === 'stretch' ? 'fill' : 'cover';
  return <ExpoImage
    {...(imageProps as any)}
    source={url ? { uri: moderationMediaUrl(url) } : null}
    cachePolicy="memory-disk"
    contentFit={contentFit}
    transition={0}
    recyclingKey={`${googleBookId ?? isbn ?? isbnKey}:${url ?? 'pending'}`}
    onError={event => onError?.(event as any)}
  />;
}
