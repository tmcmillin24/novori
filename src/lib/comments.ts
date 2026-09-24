import { supabase } from './supabase';

export type CommentVoteValue =
  | 1
  | -1;

export type CommentVoteState = {
  upvote_count: number;
  downvote_count: number;
  vote_score: number;
  viewer_vote:
    | -1
    | 0
    | 1;
};

export type PostComment = {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id:
    | string
    | null;
  body: string;
  created_at: string;
  updated_at: string;
  author_display_name:
    | string
    | null;
  author_username:
    | string
    | null;
  author_avatar_url:
    | string
    | null;
  is_own: boolean;
  upvote_count: number;
  downvote_count: number;
  vote_score: number;
  viewer_vote:
    | -1
    | 0
    | 1;
};

async function requireUser() {
  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth
      .getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error(
      'You must be signed in.'
    );
  }

  return user;
}

function normalizeVote(
  value: unknown
):
  | -1
  | 0
  | 1 {
  const numeric =
    Number(
      value ??
        0
    );

  if (
    numeric === 1
  ) {
    return 1;
  }

  if (
    numeric === -1
  ) {
    return -1;
  }

  return 0;
}

function normalizeComment(
  row:
    Record<
      string,
      unknown
    >
): PostComment {
  return {
    ...(row as unknown as PostComment),
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
      normalizeVote(
        row.viewer_vote
      ),
  };
}

export async function getPostComments(
  postId: string,
  limit = 500
): Promise<PostComment[]> {
  await requireUser();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_post_comments',
      {
        target_post_id:
          postId,
        result_limit:
          limit,
      }
    );

  if (error) {
    throw error;
  }

  return (
    data ??
    []
  ).map(
    (
      row:
        Record<
          string,
          unknown
        >
    ) =>
      normalizeComment(
        row
      )
  );
}

export async function createPostComment(
  postId: string,
  body: string,
  parentCommentId:
    | string
    | null = null
) {
  await requireUser();

  const cleaned =
    body.trim();

  if (
    cleaned.length < 1 ||
    cleaned.length > 2000
  ) {
    throw new Error(
      'Comments must be between 1 and 2,000 characters.'
    );
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'create_post_comment',
      {
        target_post_id:
          postId,
        comment_body:
          cleaned,
        target_parent_comment_id:
          parentCommentId,
      }
    );

  if (error) {
    throw error;
  }

  return data as string;
}

export async function deletePostComment(
  commentId: string
) {
  await requireUser();

  const {
    error,
  } =
    await supabase.rpc(
      'delete_post_comment',
      {
        target_comment_id:
          commentId,
      }
    );

  if (error) {
    throw error;
  }
}

export async function toggleCommentVote(
  commentId: string,
  voteValue:
    CommentVoteValue
): Promise<CommentVoteState> {
  await requireUser();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'toggle_comment_vote',
      {
        target_comment_id:
          commentId,
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
      'Could not update comment vote.'
    );
  }

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
      normalizeVote(
        row.viewer_vote
      ),
  };
}
