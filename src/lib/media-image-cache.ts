import { moderationMediaUrl } from './moderation-media-url';

/** Only public reader-uploaded buckets are persisted. Signed/private URLs stay uncached. */
export function mediaImageSource(uri: string) {
  const resolved = moderationMediaUrl(uri) ?? uri;
  const origin = process.env.EXPO_PUBLIC_MODERATION_MEDIA_ORIGIN?.replace(/\/$/, '');
  const storage = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const paths = [origin ? `${origin}/` : '', storage ? `${storage}/storage/v1/object/public/` : ''].filter(Boolean);
  const publicMedia = paths.some(prefix => resolved.startsWith(prefix) && /^(avatars|post-media|club-covers)\//.test(resolved.slice(prefix.length)));
  // Keep the full URL, including any version. Never collapse new photos onto an old cache key.
  return { uri: resolved, cachePolicy: publicMedia ? 'memory-disk' as const : 'none' as const };
}

const aspectRatios = new Map<string, number>();
export const getMediaAspectRatio = (uri: string) => aspectRatios.get(moderationMediaUrl(uri) ?? uri) ?? null;
export function rememberMediaAspectRatio(uri: string, ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return;
  const key = moderationMediaUrl(uri) ?? uri;
  aspectRatios.delete(key); aspectRatios.set(key, ratio);
  while (aspectRatios.size > 200) aspectRatios.delete(aspectRatios.keys().next().value!);
}
