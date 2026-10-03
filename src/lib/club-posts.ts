import { getClubPosts, getPostDetail, markPostMutation, type FeedPost } from './feed';
import { supabase } from './supabase';

export const MAX_CLUB_PINS = 3;
export type ClubPostPin = { club_id: string; post_id: string; pinned_at: string };
export function canManageClubPosts(role: string | null | undefined) {
  return role === 'owner' || role === 'admin';
}

export async function getClubPins(clubId: string): Promise<ClubPostPin[]> {
  const { data, error } = await supabase.from('club_post_pins')
    .select('club_id,post_id,pinned_at').eq('club_id',clubId).order('pinned_at',{ ascending: false }).limit(MAX_CLUB_PINS);
  if (error) throw error;
  return data ?? [];
}

// Pins may outlive the recent-post window. Reuse the existing, visibility-checked
// post detail loader only for those missing rows; book/provider loaders are never called.
export async function getClubConversation(clubId: string) {
  const [posts,pins] = await Promise.all([getClubPosts(clubId),getClubPins(clubId)]);
  return { posts,pinnedPosts: await resolveClubPinnedPosts(clubId,pins,posts) };
}

export async function resolveClubPinnedPosts(clubId: string,pins: ClubPostPin[],posts: FeedPost[]) {
  const byId = new Map(posts.map(post => [post.id,post]));
  await Promise.all(pins.filter(pin => !byId.has(pin.post_id)).map(async pin => {
    try {
      const post = await getPostDetail(pin.post_id);
      if (post.club_id === clubId) byId.set(post.id,post);
    } catch (error) {
      // A post can be deleted or moved between the two reads. Hide that pin;
      // a database/transport failure should still be shown to the reader.
      if (!(error instanceof Error && error.message === 'This post is unavailable.')) throw error;
    }
  }));
  const pinnedPosts: FeedPost[] = pins.flatMap(pin => {
    const post = byId.get(pin.post_id);
    return post?.club_id === clubId ? [post] : [];
  });
  return pinnedPosts;
}

export async function setClubPostPin(clubId: string,postId: string,pinned: boolean,replacePostId?: string) {
  const { error } = await supabase.rpc('set_club_post_pin',{
    target_club_id: clubId, target_post_id: postId, pin_post: pinned, replace_post_id: replacePostId ?? null,
  });
  if (error) throw error;
  markPostMutation();
}
