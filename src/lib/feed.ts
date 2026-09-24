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
  upvote_count: number;
  downvote_count: number;
  vote_score: number;
  viewer_vote: -1 | 0 | 1;
  comment_count: number;
};

export type PostVoteValue =
  | -1
  | 1;

export type PostVoteState = {
  upvote_count: number;
  downvote_count: number;
  vote_score: number;
  viewer_vote: -1 | 0 | 1;
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

export async function getPostDetail(
  postId: string
): Promise<FeedPost> {
  await getCurrentUserId();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_post_detail',
      {
        target_post_id:
          postId,
      }
    );

  if (error) {
    throw error;
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data;

  if (!row) {
    throw new Error(
      'This post is unavailable.'
    );
  }

  return row as FeedPost;
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

export async function togglePostVote(
  postId: string,
  voteValue:
    PostVoteValue
): Promise<PostVoteState> {
  await getCurrentUserId();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'toggle_post_vote',
      {
        target_post_id:
          postId,
        vote_value:
          voteValue,
      }
    );

  if (error) {
    throw error;
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data;

  if (!row) {
    throw new Error(
      'Could not update vote.'
    );
  }

  const viewerVote =
    Number(
      row.viewer_vote ??
      0
    );

  return {
    upvote_count:
      Number(
        row.upvote_count ??
        0
      ),
    downvote_count:
      Number(
        row.downvote_count ??
        0
      ),
    vote_score:
      Number(
        row.vote_score ??
        0
      ),
    viewer_vote:
      viewerVote === 1
        ? 1
        : viewerVote === -1
        ? -1
        : 0,
  };
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

export type FollowActionResult =
  | 'following'
  | 'requested';

export async function followReader(
  readerId: string
): Promise<FollowActionResult> {
  await getCurrentUserId();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'request_follow_reader',
      {
        target_user_id:
          readerId,
      }
    );

  if (error) {
    throw error;
  }

  return data ===
    'requested'
    ? 'requested'
    : 'following';
}

export async function cancelFollowRequest(
  readerId: string
) {
  await getCurrentUserId();

  const {
    error,
  } =
    await supabase.rpc(
      'cancel_follow_request',
      {
        target_user_id:
          readerId,
      }
    );

  if (error) {
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
