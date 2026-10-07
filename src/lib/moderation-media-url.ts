/** Resolve only reader-uploaded media at render time, including old local caches.
 * Catalog cover URLs and local crop/preview files pass through unchanged. */
export function moderationMediaUrl(uri: string | null | undefined): string | undefined {
  if (!uri) return undefined;
  const origin = process.env.EXPO_PUBLIC_MODERATION_MEDIA_ORIGIN?.replace(/\/$/, '');
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!origin || !supabaseUrl) return uri;
  const prefix = `${supabaseUrl}/storage/v1/object/public/`;
  if (!uri.startsWith(prefix) || !/^(avatars|post-media|club-covers)\//.test(uri.slice(prefix.length))) return uri;
  return `${origin}/${uri.slice(prefix.length)}`;
}
