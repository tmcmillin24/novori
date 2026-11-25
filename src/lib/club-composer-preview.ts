import { Image } from 'expo-image';
import { mediaImageSource } from './media-image-cache';
import { moderationMediaUrl } from './moderation-media-url';
import { supabase } from './supabase';

export type ComposerProfile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};
type ClubComposerPreview = {
  clubId: string;
  clubName: string;
  clubCover: string | null;
  userId: string;
  profile: ComposerProfile | null;
};

export async function warmComposerImage(rawUrl: string | null | undefined) {
  const url = rawUrl && moderationMediaUrl(rawUrl);
  if (!url) return;
  const source = mediaImageSource(url);
  if (source.cachePolicy === 'none') return;
  await Image.prefetch(source.uri, source.cachePolicy).catch(() => false);
}

export async function loadComposerProfile(userId: string) {
  const { data, error } = await supabase.from('profiles')
    .select('display_name, username, avatar_url').eq('id', userId).single();
  if (error) return null;
  await warmComposerImage(data?.avatar_url);
  return data as ComposerProfile | null;
}

// In-process display data only. The composer still verifies the signed-in user
// and posting permissions; names and image URLs never go in route parameters.
let sequence = 0;
let latest: { key: string; preview: ClubComposerPreview } | null = null;
export function prepareClubComposerPreview(preview: ClubComposerPreview) {
  const key = String(++sequence);
  latest = { key, preview };
  return key;
}
export function getClubComposerPreview(key: string | undefined, clubId: string) {
  return latest && latest.key === key && latest.preview.clubId === clubId ? latest.preview : null;
}

export type ComposerIdentity = { userId: string; profile: ComposerProfile | null };
let feedPreview: { key: string; identity: ComposerIdentity } | null = null;

export async function loadSignedInComposerIdentity(): Promise<ComposerIdentity | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id, profile: await loadComposerProfile(user.id) };
}

export function prepareFeedComposerPreview(identity: ComposerIdentity) {
  const key = String(++sequence);
  feedPreview = { key, identity };
  return key;
}

export function getFeedComposerPreview(key?: string) {
  return feedPreview && feedPreview.key === key ? feedPreview.identity : null;
}
