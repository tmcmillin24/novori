import { supabase } from './supabase';
import {
  getCanonicalBookPresentations,
} from './user-books';

export type FeedPostType =
  | 'post'
  | 'reading_update'
  | 'review'
  | 'question'
  | 'book_stack';

export type FeedPost = {
  id: string;
  author_id: string;
  club_id: string | null;
  post_type: FeedPostType;
  body: string;
  google_book_id: string | null;
  book_title: string | null;
  book_cover_url: string | null;
  book_authors: string[] | null;
  book_series_name: string | null;
  book_series_position: number | null;
  post_image_url: string | null;
  rating: number | null;
  book_stack_id: string | null;
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

export function splitQuestionPostBody(
  body: string
) {
  const parts =
    body
      .trim()
      .split(
        /\n\s*\n/
      );

  const question =
    parts.shift()
      ?.trim() ??
    '';

  const context =
    parts
      .join(
        '\n\n'
      )
      .trim();

  return {
    question,
    context,
  };
}

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

async function attachPostImageUrls(
  posts: FeedPost[]
): Promise<FeedPost[]> {
  if (
    posts.length === 0
  ) {
    return posts;
  }

  const postIds =
    posts.map(
      (post) =>
        post.id
    );

  const {
    data,
    error,
  } =
    await supabase
      .from('posts')
      .select(
        'id, post_image_url, book_authors, book_series_name, book_series_position, book_stack_id'
      )
      .in(
        'id',
        postIds
      );

  if (error) {
    console.warn(
      'Could not load post media:',
      error
    );

    return posts.map(
      (post) => ({
        ...post,
        post_image_url:
          post.post_image_url ??
          null,
        book_authors:
          post.book_authors ??
          null,
        book_series_name:
          post.book_series_name ??
          null,
        book_series_position:
          post.book_series_position ??
          null,
      })
    );
  }

  const metadataByPostId =
    new Map(
      (data ?? []).map(
        (row) => [
          row.id as string,
          {
            imageUrl:
              (row.post_image_url ??
                null) as
                | string
                | null,
            authors:
              Array.isArray(
                row.book_authors
              )
                ? row.book_authors
                    .filter(
                      (
                        author
                      ): author is string =>
                        typeof author ===
                        'string' &&
                        author.trim()
                          .length >
                          0
                    )
                : null,
            seriesName:
              typeof row.book_series_name ===
                'string' &&
              row.book_series_name.trim()
                .length >
                0
                ? row.book_series_name
                : null,
            seriesPosition:
              row.book_series_position !==
                null &&
              row.book_series_position !==
                undefined
                ? Number(
                    row.book_series_position
                  )
                : null,
            bookStackId:
              typeof row.book_stack_id ===
                'string'
                ? row.book_stack_id
                : null,
          },
        ]
      )
    );

  return posts.map(
    (post) => {
      const metadata =
        metadataByPostId.get(
          post.id
        );

      return {
        ...post,
        post_image_url:
          metadata
            ?.imageUrl ??
          post.post_image_url ??
          null,
        book_authors:
          metadata
            ?.authors ??
          post.book_authors ??
          null,
        book_series_name:
          metadata
            ?.seriesName ??
          post.book_series_name ??
          null,
        book_series_position:
          metadata
            ?.seriesPosition ??
          post.book_series_position ??
          null,
        book_stack_id:
          metadata
            ?.bookStackId ??
          post.book_stack_id ??
          null,
      };
    }
  );
}

export async function canonicalizeFeedPosts(
  posts: FeedPost[]
): Promise<FeedPost[]> {
  const googleBookIds =
    posts
      .map(
        (
          post
        ) =>
          post.google_book_id
      )
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            value
          )
      );

  if (
    googleBookIds.length ===
      0
  ) {
    return posts;
  }

  const canonicalBooks =
    await getCanonicalBookPresentations(
      googleBookIds
    );

  if (
    canonicalBooks.size ===
      0
  ) {
    return posts;
  }

  return posts.map(
    (
      post
    ) => {
      if (
        !post.google_book_id
      ) {
        return post;
      }

      const canonical =
        canonicalBooks.get(
          post.google_book_id
        );

      if (!canonical) {
        return post;
      }

      return {
        ...post,
        book_title:
          canonical.title ||
          post.book_title,
        book_cover_url:
          canonical.coverUrl ??
          post.book_cover_url,
        book_authors:
          canonical.authors.length >
            0
            ? canonical.authors
            : post.book_authors,
      };
    }
  );
}

export type PostImageUpload = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export async function uploadPostImage(
  photo: PostImageUpload
) {
  const userId =
    await getCurrentUserId();

  const response =
    await fetch(
      photo.uri
    );

  if (!response.ok) {
    throw new Error(
      'Could not read the selected photo.'
    );
  }

  const blob =
    await response.blob();

  const rawExtension =
    photo.fileName
      ?.split('.')
      .pop()
      ?.toLowerCase() ||
    photo.mimeType
      ?.split('/')
      .pop()
      ?.toLowerCase() ||
    'jpg';

  const extension =
    rawExtension.replace(
      /[^a-z0-9]/g,
      ''
    ) ||
    'jpg';

  const filePath =
    `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

  const {
    error:
      uploadError,
  } =
    await supabase.storage
      .from(
        'post-media'
      )
      .upload(
        filePath,
        blob,
        {
          contentType:
            photo.mimeType ??
            'image/jpeg',
          upsert:
            false,
        }
      );

  if (uploadError) {
    throw uploadError;
  }

  const {
    data:
      publicUrlData,
  } =
    supabase.storage
      .from(
        'post-media'
      )
      .getPublicUrl(
        filePath
      );

  return (
    publicUrlData.publicUrl
  );
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

  const posts =
    (
      data ??
      []
    ) as FeedPost[];

  return canonicalizeFeedPosts(
    await attachPostImageUrls(
      posts
    )
  );
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

  const [
    hydratedPost,
  ] =
    await attachPostImageUrls([
      row as FeedPost,
    ]);

  const [
    canonicalPost,
  ] =
    await canonicalizeFeedPosts([
      hydratedPost,
    ]);

  return canonicalPost;
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

  const posts =
    (
      data ??
      []
    ) as FeedPost[];

  return canonicalizeFeedPosts(
    await attachPostImageUrls(
      posts
    )
  );
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
  bookAuthors?: string[] | null;
  bookSeriesName?: string | null;
  bookSeriesPosition?: number | null;
  imageUrl?: string | null;
  rating?: number | null;
  bookStackId?: string | null;
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
        book_authors:
          input.bookAuthors ??
          null,
        book_series_name:
          input.bookSeriesName ??
          null,
        book_series_position:
          input.bookSeriesPosition ??
          null,
        post_image_url:
          input.imageUrl ??
          null,
        rating:
          input.rating ??
          null,
        book_stack_id:
          input.bookStackId ??
          null,
      })
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return data;
}


export async function updatePost(
  postId: string,
  input: {
    body: string;
    clubId?: string | null;
    googleBookId?: string | null;
    bookTitle?: string | null;
    bookCoverUrl?: string | null;
    bookAuthors?: string[] | null;
    bookSeriesName?: string | null;
    bookSeriesPosition?: number | null;
    imageUrl?: string | null;
  }
) {
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
      .update({
        body,
        club_id:
          input.clubId ??
          null,
        google_book_id:
          input.googleBookId ??
          null,
        book_title:
          input.bookTitle ??
          null,
        book_cover_url:
          input.bookCoverUrl ??
          null,
        book_authors:
          input.bookAuthors ??
          null,
        book_series_name:
          input.bookSeriesName ??
          null,
        book_series_position:
          input.bookSeriesPosition ??
          null,
        post_image_url:
          input.imageUrl ??
          null,
      })
      .eq(
        'id',
        postId
      )
      .eq(
        'author_id',
        userId
      )
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deletePost(
  postId: string
) {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } =
    await supabase
      .from('posts')
      .delete()
      .eq(
        'id',
        postId
      )
      .eq(
        'author_id',
        userId
      )
      .select('id')
      .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}


export type CommunityBookReview = {
  id: string;
  author_id: string;
  body: string;
  rating: number | null;
  created_at: string;
  author_display_name: string | null;
  author_username: string | null;
  author_avatar_url: string | null;
};

export async function getCommunityBookReviews(
  googleBookId: string,
  bookTitle?: string | null,
  limit = 30
): Promise<CommunityBookReview[]> {
  await getCurrentUserId();

  async function loadReviewRows(
    mode:
      | 'id'
      | 'title'
  ) {
    let query =
      supabase
        .from(
          'posts'
        )
        .select(
          'id, author_id, body, rating, created_at'
        )
        .eq(
          'post_type',
          'review'
        )
        .order(
          'created_at',
          {
            ascending: false,
          }
        )
        .limit(
          limit
        );

    if (
      mode ===
      'id'
    ) {
      query =
        query.eq(
          'google_book_id',
          googleBookId
        );
    } else {
      query =
        query.eq(
          'book_title',
          bookTitle?.trim() ??
          ''
        );
    }

    const {
      data,
      error,
    } =
      await query;

    if (error) {
      throw error;
    }

    return (
      data ?? []
    );
  }

  const exactRows =
    await loadReviewRows(
      'id'
    );

  let combinedRows = [
    ...exactRows,
  ];

  if (
    combinedRows.length <
      limit &&
    bookTitle?.trim()
  ) {
    try {
      const titleRows =
        await loadReviewRows(
          'title'
        );

      const seen =
        new Set(
          combinedRows.map(
            (
              row
            ) =>
              String(
                row.id
              )
          )
        );

      for (
        const row of
        titleRows
      ) {
        const rowId =
          String(
            row.id
          );

        if (
          seen.has(
            rowId
          )
        ) {
          continue;
        }

        combinedRows.push(
          row
        );
        seen.add(
          rowId
        );

        if (
          combinedRows.length >=
          limit
        ) {
          break;
        }
      }
    } catch (
      error
    ) {
      console.warn(
        'Could not supplement community reviews by title:',
        error
      );
    }
  }

  combinedRows =
    combinedRows.slice(
      0,
      limit
    );

  if (
    combinedRows.length ===
    0
  ) {
    return [];
  }

  const authorIds =
    Array.from(
      new Set(
        combinedRows.map(
          (
            row
          ) =>
            String(
              row.author_id
            )
        )
      )
    );

  const {
    data:
      profileRows,
    error:
      profileError,
  } =
    await supabase
      .from(
        'profiles'
      )
      .select(
        'id, display_name, username, avatar_url'
      )
      .in(
        'id',
        authorIds
      );

  if (
    profileError
  ) {
    console.warn(
      'Could not load community review authors:',
      profileError
    );
  }

  const profiles =
    new Map(
      (
        profileRows ??
        []
      ).map(
        (
          profile
        ) => [
          String(
            profile.id
          ),
          profile,
        ]
      )
    );

  return combinedRows.map(
    (
      row
    ) => {
      const profile =
        profiles.get(
          String(
            row.author_id
          )
        );

      const numericRating =
        row.rating ===
          null ||
        row.rating ===
          undefined
          ? null
          : Number(
              row.rating
            );

      return {
        id:
          String(
            row.id
          ),
        author_id:
          String(
            row.author_id
          ),
        body:
          String(
            row.body ??
            ''
          ),
        rating:
          numericRating !==
            null &&
          Number.isFinite(
            numericRating
          )
            ? numericRating
            : null,
        created_at:
          String(
            row.created_at ??
            ''
          ),
        author_display_name:
          typeof profile?.display_name ===
            'string'
            ? profile.display_name
            : null,
        author_username:
          typeof profile?.username ===
            'string'
            ? profile.username
            : null,
        author_avatar_url:
          typeof profile?.avatar_url ===
            'string'
            ? profile.avatar_url
            : null,
      };
    }
  );
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
