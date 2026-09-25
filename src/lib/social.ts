import {
  ClubWithMembership,
} from './clubs';
import {
  FeedPost,
} from './feed';
import { supabase } from './supabase';

export type ReaderSocialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  follower_count: number;
  following_count: number;
  is_following: boolean;
  is_self: boolean;
  is_private: boolean;
  follow_request_pending: boolean;
  can_view_content: boolean;
  show_books: boolean;
  show_reviews: boolean;
  can_view_books: boolean;
  can_view_reviews: boolean;
};

export type ReaderConnection = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_following: boolean;
  is_self: boolean;
  is_private: boolean;
  follow_request_pending: boolean;
};

export type ReaderConnectionType =
  | 'followers'
  | 'following';

export type PublicReaderBook = {
  id: string;
  google_book_id: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  published_date: string | null;
  status:
    | 'reading'
    | 'read'
    | 'dnf';
  started_at: string | null;
  finished_at: string | null;
  dnf_at: string | null;
  updated_at: string;
};

export type PublicReaderReview = {
  id: string;
  google_book_id: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  published_date: string | null;
  status: string;
  rating: number | null;
  review_text: string | null;
  updated_at: string;
};

export type IncomingFollowRequest = {
  requester_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export async function getReaderProfile(
  readerId: string
): Promise<ReaderSocialProfile> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_reader_profile',
      {
        target_user_id:
          readerId,
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
      'Reader profile not found.'
    );
  }

  return {
    ...row,
    follower_count:
      Number(
        row.follower_count ??
          0
      ),
    following_count:
      Number(
        row.following_count ??
          0
      ),
    is_following:
      Boolean(
        row.is_following
      ),
    is_self:
      Boolean(
        row.is_self
      ),
    is_private:
      Boolean(
        row.is_private
      ),
    follow_request_pending:
      Boolean(
        row.follow_request_pending
      ),
    can_view_content:
      Boolean(
        row.can_view_content
      ),
    show_books:
      row.show_books ??
      true,
    show_reviews:
      row.show_reviews ??
      true,
    can_view_books:
      Boolean(
        row.can_view_books
      ),
    can_view_reviews:
      Boolean(
        row.can_view_reviews
      ),
  } as ReaderSocialProfile;
}

export async function getReaderPublicBooks(
  readerId: string,
  limit = 100
): Promise<PublicReaderBook[]> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_reader_public_books',
      {
        target_user_id:
          readerId,
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
    (row: any) => ({
      ...row,
      authors:
        Array.isArray(
          row.authors
        )
          ? row.authors
          : [],
    })
  ) as PublicReaderBook[];
}

export async function getReaderPublicReviews(
  readerId: string,
  limit = 100
): Promise<PublicReaderReview[]> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_reader_public_reviews',
      {
        target_user_id:
          readerId,
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
    (row: any) => ({
      ...row,
      authors:
        Array.isArray(
          row.authors
        )
          ? row.authors
          : [],
      rating:
        row.rating ===
        null
          ? null
          : Number(
              row.rating
            ),
    })
  ) as PublicReaderReview[];
}

export async function getReaderConnections(
  readerId: string,
  type:
    ReaderConnectionType,
  limit = 100
): Promise<ReaderConnection[]> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_reader_connections',
      {
        target_user_id:
          readerId,
        connection_type:
          type,
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
    (row: any) => ({
      ...row,
      is_following:
        Boolean(
          row.is_following
        ),
      is_self:
        Boolean(
          row.is_self
        ),
      is_private:
        Boolean(
          row.is_private
        ),
      follow_request_pending:
        Boolean(
          row.follow_request_pending
        ),
    })
  ) as ReaderConnection[];
}

export async function getReaderProfilePosts(
  readerId: string,
  limit = 50
): Promise<FeedPost[]> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_reader_profile_posts',
      {
        target_user_id:
          readerId,
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
  ) as FeedPost[];
}

export async function getReaderPublicClubs(
  readerId: string,
  limit = 30
): Promise<ClubWithMembership[]> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_reader_public_clubs',
      {
        target_user_id:
          readerId,
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
    (row: any) => ({
      ...row,
      membership_role:
        row.membership_role ??
        null,
    })
  ) as ClubWithMembership[];
}


export async function getIncomingFollowRequests(
  limit = 100
): Promise<IncomingFollowRequest[]> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_follow_requests',
      {
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
  ) as IncomingFollowRequest[];
}

export async function getPendingFollowRequestCount():
Promise<number> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_pending_follow_request_count'
    );

  if (error) {
    throw error;
  }

  return Number(
    data ??
    0
  );
}

export async function acceptFollowRequest(
  requesterId: string
) {
  const {
    error,
  } =
    await supabase.rpc(
      'accept_follow_request',
      {
        requester_user_id:
          requesterId,
      }
    );

  if (error) {
    throw error;
  }
}

export async function declineFollowRequest(
  requesterId: string
) {
  const {
    error,
  } =
    await supabase.rpc(
      'decline_follow_request',
      {
        requester_user_id:
          requesterId,
      }
    );

  if (error) {
    throw error;
  }
}

export async function searchReaders(
  query: string,
  limit = 30
): Promise<ReaderConnection[]> {
  const normalized =
    query.trim();

  if (!normalized) {
    return [];
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'search_readers',
      {
        search_term:
          normalized,
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
    (row: any) => ({
      ...row,
      is_following:
        Boolean(
          row.is_following
        ),
      is_self:
        Boolean(
          row.is_self
        ),
      is_private:
        Boolean(
          row.is_private
        ),
      follow_request_pending:
        Boolean(
          row.follow_request_pending
        ),
    })
  ) as ReaderConnection[];
}


export async function blockReader(
  readerId: string
) {
  const {
    error,
  } =
    await supabase.rpc(
      'block_reader',
      {
        target_user_id:
          readerId,
      }
    );

  if (error) {
    throw error;
  }
}

export async function unblockReader(
  readerId: string
) {
  const {
    error,
  } =
    await supabase.rpc(
      'unblock_reader',
      {
        target_user_id:
          readerId,
      }
    );

  if (error) {
    throw error;
  }
}

export type BlockedReader = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  blocked_at: string;
};

export async function getBlockedReaders(
  limit = 200
): Promise<BlockedReader[]> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_blocked_readers',
      {
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
  ) as BlockedReader[];
}


export async function isReaderBlockedByViewer(
  readerId: string
): Promise<boolean> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'is_reader_blocked_by_viewer',
      {
        target_user_id:
          readerId,
      }
    );

  if (error) {
    throw error;
  }

  return Boolean(
    data
  );
}
