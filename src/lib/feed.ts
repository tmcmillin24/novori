import { supabase } from './supabase';

export type FeedPostType =
  | 'post'
  | 'reading_update'
  | 'review';

export type FeedPost = {
  id: string;
  author_id: string;
  club_id: string | null;
  post_type: FeedPostType;
  body: string;
  google_book_id: string | null;
  book_title: string | null;
  book_cover_url: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
  author_display_name: string | null;
  author_username: string | null;
  author_avatar_url: string | null;
  club_name: string | null;
  club_cover_url: string | null;
  club_privacy: string | null;
};

async function getCurrentUserId() {
  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error(
      'You must be signed in.'
    );
  }

  return user.id;
}

export async function getHomeFeed(
  limit = 50
): Promise<FeedPost[]> {
  await getCurrentUserId();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_home_feed',
      {
        feed_limit:
          limit,
      }
    );

  if (error) {
    throw error;
  }

  return (
    data ??
    []
  ) as FeedPost[];
}

export async function getClubPosts(
  clubId: string,
  limit = 50
): Promise<FeedPost[]> {
  await getCurrentUserId();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_club_posts',
      {
        target_club_id:
          clubId,
        feed_limit:
          limit,
      }
    );

  if (error) {
    throw error;
  }

  return (
    data ??
    []
  ) as FeedPost[];
}

export async function createPost(input: {
  body: string;
  clubId?: string | null;
  postType?: FeedPostType;
  googleBookId?: string | null;
  bookTitle?: string | null;
  bookCoverUrl?: string | null;
  rating?: number | null;
}) {
  const userId =
    await getCurrentUserId();

  const body =
    input.body.trim();

  if (
    body.length < 1 ||
    body.length > 4000
  ) {
    throw new Error(
      'Posts must be between 1 and 4,000 characters.'
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from('posts')
      .insert({
        author_id:
          userId,
        club_id:
          input.clubId ??
          null,
        post_type:
          input.postType ??
          'post',
        body,
        google_book_id:
          input.googleBookId ??
          null,
        book_title:
          input.bookTitle ??
          null,
        book_cover_url:
          input.bookCoverUrl ??
          null,
        rating:
          input.rating ??
          null,
      })
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function followReader(
  readerId: string
) {
  const userId =
    await getCurrentUserId();

  if (
    readerId ===
    userId
  ) {
    throw new Error(
      'You cannot follow yourself.'
    );
  }

  const {
    error,
  } =
    await supabase
      .from('follows')
      .insert({
        follower_id:
          userId,
        following_id:
          readerId,
      });

  if (
    error &&
    error.code !==
      '23505'
  ) {
    throw error;
  }
}

export async function unfollowReader(
  readerId: string
) {
  const userId =
    await getCurrentUserId();

  const {
    error,
  } =
    await supabase
      .from('follows')
      .delete()
      .eq(
        'follower_id',
        userId
      )
      .eq(
        'following_id',
        readerId
      );

  if (error) {
    throw error;
  }
}

export async function isFollowingReader(
  readerId: string
) {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } =
    await supabase
      .from('follows')
      .select(
        'following_id'
      )
      .eq(
        'follower_id',
        userId
      )
      .eq(
        'following_id',
        readerId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(
    data
  );
}

export async function getFollowCounts(
  readerId: string
) {
  const [
    followersResult,
    followingResult,
  ] =
    await Promise.all([
      supabase
        .from('follows')
        .select(
          '*',
          {
            count:
              'exact',
            head:
              true,
          }
        )
        .eq(
          'following_id',
          readerId
        ),
      supabase
        .from('follows')
        .select(
          '*',
          {
            count:
              'exact',
            head:
              true,
          }
        )
        .eq(
          'follower_id',
          readerId
        ),
    ]);

  if (
    followersResult.error
  ) {
    throw followersResult.error;
  }

  if (
    followingResult.error
  ) {
    throw followingResult.error;
  }

  return {
    followers:
      followersResult.count ??
      0,
    following:
      followingResult.count ??
      0,
  };
}
