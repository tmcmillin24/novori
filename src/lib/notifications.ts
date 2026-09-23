import { supabase } from './supabase';

export type NotificationType =
  | 'follow'
  | 'post_like'
  | 'review_like'
  | 'comment'
  | 'reply'
  | 'club_invite'
  | 'club_post'
  | 'club_event'
  | 'club_member'
  | 'reading_started'
  | 'reading_finished'
  | 'system';

export type NovoriNotification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  actor_display_name: string | null;
  actor_username: string | null;
  actor_avatar_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  image_url: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type NotificationPreferences = {
  user_id: string;
  new_followers: boolean;
  reactions_and_replies: boolean;
  club_invites: boolean;
  club_activity: boolean;
  reading_started: boolean;
  reading_finished: boolean;
  updated_at: string;
};

export type NotificationPreferenceKey =
  | 'new_followers'
  | 'reactions_and_replies'
  | 'club_invites'
  | 'club_activity'
  | 'reading_started'
  | 'reading_finished';

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error(
      'You must be signed in to use notifications.'
    );
  }

  return user.id;
}

export async function getNotifications(
  limit = 75
): Promise<NovoriNotification[]> {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order(
      'created_at',
      { ascending: false }
    )
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as NovoriNotification[];
}

export async function getUnreadNotificationCount() {
  const userId =
    await getCurrentUserId();

  const {
    count,
    error,
  } = await supabase
    .from('notifications')
    .select(
      'id',
      {
        count: 'exact',
        head: true,
      }
    )
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function markNotificationRead(
  notificationId: string
) {
  const userId =
    await getCurrentUserId();

  const { error } =
    await supabase
      .from('notifications')
      .update({
        read_at:
          new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('recipient_id', userId)
      .is('read_at', null);

  if (error) {
    throw error;
  }
}

export async function markAllNotificationsRead() {
  const userId =
    await getCurrentUserId();

  const { error } =
    await supabase
      .from('notifications')
      .update({
        read_at:
          new Date().toISOString(),
      })
      .eq('recipient_id', userId)
      .is('read_at', null);

  if (error) {
    throw error;
  }
}

export async function getNotificationPreferences():
Promise<NotificationPreferences> {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as NotificationPreferences;
  }

  const {
    data: created,
    error: createError,
  } = await supabase
    .from('notification_preferences')
    .insert({
      user_id: userId,
    })
    .select('*')
    .single();

  if (createError) {
    throw createError;
  }

  return created as NotificationPreferences;
}

export async function updateNotificationPreference(
  key: NotificationPreferenceKey,
  enabled: boolean
): Promise<NotificationPreferences> {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        [key]: enabled,
        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as NotificationPreferences;
}
