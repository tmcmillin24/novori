import type { NovoriNotification } from './notifications';
import { getClubNotificationDestination } from './club-notification-route';
import { getReadingReminderDestination } from './reading-reminders';

// Both the inbox and remote notification taps use this single destination map.
export function getNotificationDestination(item: NovoriNotification) {
  const special = getReadingReminderDestination(item) ?? getClubNotificationDestination(item);
  if (special) return special;
  if (item.type === 'follow_request') return { pathname: '/follow-requests' as const };
  if (item.type === 'follow' || item.type === 'follow_request_accepted') {
    const id = item.entity_id ?? item.actor_id;
    return id ? { pathname: '/reader/[id]' as const, params: { id } } : null;
  }
  const postId = typeof item.metadata?.post_id === 'string' ? item.metadata.post_id : item.entity_type === 'post' ? item.entity_id : null;
  if (postId) return { pathname: '/post/[id]' as const, params: { id: postId, ...(typeof item.metadata?.comment_id === 'string' ? { commentId: item.metadata.comment_id } : {}) } };
  const id = item.metadata?.google_book_id;
  if (typeof id === 'string' && id) return { pathname: '/book/[id]' as const, params: { id, source: 'notifications' } };
  if (item.entity_type === 'club' && item.entity_id) return { pathname: '/club/[id]' as const, params: { id: item.entity_id } };
  return null;
}
