import type { NovoriNotification } from './notifications';
export function anonymizeVoteNotification(item: NovoriNotification): NovoriNotification {
  if (item.type !== 'post_vote' && item.type !== 'comment_vote') return item;
  const verb = Number(item.metadata?.vote_value) === -1 ? 'downvoted' : Number(item.metadata?.vote_value) === 1 ? 'upvoted' : 'reacted to';
  return { ...item, actor_id: null, actor_display_name: null, actor_username: null,
    actor_avatar_url: null, image_url: null, body: null,
    title: `Someone ${verb} your ${item.type === 'comment_vote' ? 'comment' : 'post'}.` };
}
