import { supabase } from './supabase';

let suppressAttentionCountWhileMarking = false;

export type NotificationType =
  | 'follow'
  | 'follow_request'
  | 'follow_request_accepted'
  | 'post_like'
  | 'review_like'
  | 'post_vote'
  | 'comment_vote'
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

  const notifications =
    (data ?? []) as NovoriNotification[];

  const actorIds =
    Array.from(
      new Set(
        notifications
          .map(
            (item) =>
              item.actor_id
          )
          .filter(
            (
              actorId
            ): actorId is string =>
              Boolean(
                actorId
              )
          )
      )
    );

  if (
    actorIds.length ===
    0
  ) {
    return notifications;
  }

  const {
    data: profiles,
    error: profilesError,
  } = await supabase
    .from('profiles')
    .select(
      'id, display_name, username, avatar_url'
    )
    .in(
      'id',
      actorIds
    );

  if (
    profilesError
  ) {
    console.error(
      'Could not hydrate notification actor profiles:',
      profilesError.message
    );

    return notifications;
  }

  const profilesById =
    new Map(
      (
        profiles ?? []
      ).map(
        (profile) => [
          profile.id,
          profile,
        ]
      )
    );

  return notifications.map(
    (notification) => {
      if (
        !notification.actor_id
      ) {
        return notification;
      }

      const profile =
        profilesById.get(
          notification.actor_id
        );

      if (
        !profile
      ) {
        return notification;
      }

      return {
        ...notification,
        actor_display_name:
          profile.display_name ??
          notification.actor_display_name,
        actor_username:
          profile.username ??
          notification.actor_username,
        actor_avatar_url:
          profile.avatar_url ??
          notification.actor_avatar_url,
      };
    }
  );
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


export async function getNotificationAttentionCount() {
  if (
    suppressAttentionCountWhileMarking
  ) {
    return 0;
  }

  return getUnreadNotificationCount();
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

  suppressAttentionCountWhileMarking =
    true;

  try {
    const { error } =
      await supabase
        .from('notifications')
        .update({
          read_at:
            new Date().toISOString(),
        })
        .eq(
          'recipient_id',
          userId
        )
        .is(
          'read_at',
          null
        );

    if (error) {
      throw error;
    }
  } finally {
    suppressAttentionCountWhileMarking =
      false;
  }
}

export async function clearNotification(
  notificationId: string
) {
  const userId =
    await getCurrentUserId();

  const {
    error,
  } =
    await supabase
      .from('notifications')
      .delete()
      .eq(
        'id',
        notificationId
      )
      .eq(
        'recipient_id',
        userId
      );

  if (error) {
    throw error;
  }
}

export async function clearAllNotifications() {
  const userId =
    await getCurrentUserId();

  const {
    error,
  } =
    await supabase
      .from('notifications')
      .delete()
      .eq(
        'recipient_id',
        userId
      );

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
