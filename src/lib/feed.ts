import {getSessionReadScope,invalidateSessionReads,sessionRead} from './session-read-cache';
import { parseClubEvent,type ClubEvent } from './club-event';
import { parseClubDiscussion,type ClubDiscussion } from './club-discussion';
import { supabase } from './supabase';
import { parseReadingRecapSnapshot, type ReadingRecapSnapshot } from './reading-recap-card';

let postMutationVersion = 0;

export function getPostMutationVersion() {
  return postMutationVersion;
}

function bumpPostMutationVersion() {
  postMutationVersion += 1;
  invalidateSessionReads('post:');
  invalidateSessionReads('comments:');
}

export function markPostMutation() {
  bumpPostMutationVersion();
}

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
  contains_spoilers?: boolean;
  google_book_id: string | null;
  book_title: string | null;
  book_cover_url: string | null;
  book_authors: string[] | null;
  book_series_name: string | null;
  book_series_position: number | null;
  post_image_url: string | null;
  rating: number | null;
  book_stack_id: string | null;
  reading_recap?: ReadingRecapSnapshot | null;
  is_club_announcement?: boolean;
  club_event?: ClubEvent | null;
  club_discussion?: ClubDiscussion | null;
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

export async function attachPostImageUrls(
  posts: FeedPost[]
): Promise<FeedPost[]> {
  posts = posts.map(post => post.author_id ? post : { ...post, author_id: '', body: 'This post was deleted.', author_display_name: 'Deleted user', author_username: null, author_avatar_url: null });
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

  let {
    data,
    error,
  } =
    await supabase
      .from('posts')
      .select(
        'id, contains_spoilers, post_image_url, book_authors, book_series_name, book_series_position, book_stack_id, reading_recap, is_club_announcement, club_event:club_events!club_events_post_id_fkey(id,club_id,post_id,created_by,title,description,starts_at,ends_at,timezone,kind,location,meeting_url,book,cancelled_at,created_at,updated_at), club_discussion:club_discussions!club_discussions_post_id_fkey(id,club_id,post_id,read_id,created_by,kind,title,prompt,book,contains_spoilers,spoiler_label,options,closed_at,voting_started_at,created_at,updated_at)'
      )
      .in(
        'id',
        postIds
      );

  // Keep event and existing media metadata on servers awaiting Phase 5.
  if (['42703','42P01','PGRST200','PGRST204','PGRST205'].includes(error?.code ?? '')) {
    const legacyDiscussions = await supabase.from('posts').select('id, post_image_url, book_authors, book_series_name, book_series_position, book_stack_id, reading_recap, is_club_announcement, club_event:club_events!club_events_post_id_fkey(id,club_id,post_id,created_by,title,description,starts_at,ends_at,timezone,kind,location,meeting_url,book,cancelled_at,created_at,updated_at)').in('id',postIds);
    data = legacyDiscussions.data as typeof data;error = legacyDiscussions.error;
  }
  // Preserve all existing post metadata if the event relationship is not installed yet.
  if (['42703','42P01','PGRST200','PGRST204','PGRST205'].includes(error?.code ?? '')) {
    const legacyEvents = await supabase.from('posts').select('id, post_image_url, book_authors, book_series_name, book_series_position, book_stack_id, reading_recap, is_club_announcement').in('id',postIds);
    data = legacyEvents.data as typeof data;error = legacyEvents.error;
  }

  // Older servers may not have club announcements yet; keep recap/media hydration.
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    const recap = await supabase.from('posts')
      .select('id, post_image_url, book_authors, book_series_name, book_series_position, book_stack_id, reading_recap').in('id', postIds);
    data = recap.data as typeof data; error = recap.error;
  }

  // Preserve existing media if an older server has not installed sharing yet.
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    const legacy = await supabase.from('posts')
      .select('id, post_image_url, book_authors, book_series_name, book_series_position, book_stack_id').in('id', postIds);
    data = legacy.data as typeof data; error = legacy.error;
  }

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
            spoilers: row.contains_spoilers === true,
            clubEvent: parseClubEvent(row.club_event),
            clubDiscussion: parseClubDiscussion(row.club_discussion),
            announcement: row.is_club_announcement === true,
            readingRecap: parseReadingRecapSnapshot(row.reading_recap),
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
        contains_spoilers: metadata?.spoilers ?? post.contains_spoilers ?? false,
        club_event: metadata?.clubEvent ?? parseClubEvent(post.club_event),
        club_discussion: metadata?.clubDiscussion ?? parseClubDiscussion(post.club_discussion),
        is_club_announcement: metadata?.announcement ?? post.is_club_announcement ?? false,
        reading_recap: metadata?.readingRecap ?? parseReadingRecapSnapshot(post.reading_recap),
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

  const imageBytes =
    await response.arrayBuffer();

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
        imageBytes,
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

  return (
    await attachPostImageUrls(
      posts
    )
  );
}

export async function getPostDetail(postId:string,options:{force?:boolean}={}):Promise<FeedPost> {
  const scope=await getSessionReadScope();
  if(!scope.userId)throw new Error('You must be signed in.');
  return sessionRead(scope.key,`post:${postId}`,async signal=>{
    const {data,error}=await supabase.rpc('get_post_detail',{target_post_id:postId}).abortSignal(signal);
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    if(!row)throw new Error('This post is unavailable.');
    const [hydratedPost]=await attachPostImageUrls([row as FeedPost]);
    return hydratedPost;
  },options);
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

  return (
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

  bumpPostMutationVersion();

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
  containsSpoilers?: boolean;
  clubId?: string | null;
  postType?: FeedPostType;
  isClubAnnouncement?: boolean;
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

  if (input.isClubAnnouncement && (!input.clubId || (input.postType ?? 'post') !== 'post')) {
    throw new Error('Announcements must be posted to a club.');
  }

  const allowsEmptyBody =
    input.postType ===
    'book_stack';

  if (
    (
      !allowsEmptyBody &&
      body.length < 1
    ) ||
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
        ...(input.isClubAnnouncement ? { is_club_announcement: true } : {}),
        author_id:
          userId,
        club_id:
          input.clubId ??
          null,
        post_type:
          input.postType ??
          'post',
        body,
        contains_spoilers: input.containsSpoilers === true,
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
    containsSpoilers?: boolean;
    allowEmptyBody?: boolean;
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
    (
      !input.allowEmptyBody &&
      body.length < 1
    ) ||
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
        ...('containsSpoilers' in input ? { contains_spoilers: input.containsSpoilers === true } : {}),
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

  bumpPostMutationVersion();

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

  bumpPostMutationVersion();

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
