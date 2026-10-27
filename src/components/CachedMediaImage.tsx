import { Image as ExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import type { ImageProps } from 'react-native';
import { mediaImageSource } from '../lib/media-image-cache';

/** Compatibility with existing media layouts/events, using one shared native image cache. */
export default function CachedMediaImage({ source, resizeMode = 'cover', onLoad, onError, onLoadEnd, onLoadStart, ...rest }: ImageProps) {
  const uri = source && !Array.isArray(source) && typeof source === 'object' ? source.uri : undefined;
  const media = uri ? mediaImageSource(uri) : null;
  return <ExpoImage {...rest as ExpoImageProps}
    source={media ? { ...source as object, uri: media.uri } : source}
    contentFit={resizeMode === 'stretch' ? 'fill' : resizeMode === 'repeat' ? 'cover' : resizeMode === 'center' ? 'none' : resizeMode}
    cachePolicy={media?.cachePolicy ?? 'none'} transition={0} recyclingKey={media?.uri}
    onLoadStart={onLoadStart}
    onLoadEnd={onLoadEnd}
    onLoad={event => onLoad?.({ nativeEvent: { source: { width: event.source.width, height: event.source.height, uri: event.source.url } } } as Parameters<NonNullable<ImageProps['onLoad']>>[0])}
    onError={event => onError?.({ nativeEvent: { error: event.error } } as Parameters<NonNullable<ImageProps['onError']>>[0])}/>;
}
