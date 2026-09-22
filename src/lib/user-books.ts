import { supabase } from './supabase';

export type UserBookStatus =
  | 'want_to_read'
  | 'reading'
  | 'read'
  | 'dnf';

export type UserBook = {
  id: string;
  user_id: string;

  google_book_id: string;

  title: string;
  authors: string[];

  cover_url: string | null;
  isbn: string | null;
  published_date: string | null;

  status: UserBookStatus;

  rating: number | null;
  review_text: string | null;

  started_at: string | null;
  finished_at: string | null;

  created_at: string;
  updated_at: string;
};

export type SaveUserBookInput = {
  googleBookId: string;

  title: string;

  authors?: string[];

  coverUrl?: string | null;

  isbn?: string | null;

  publishedDate?: string | null;

  status: UserBookStatus;
};

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
      'You must be signed in to manage your books.'
    );
  }

  return user.id;
}

export async function getUserBook(
  googleBookId: string
) {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } = await supabase
    .from('user_books')
    .select('*')
    .eq(
      'user_id',
      userId
    )
    .eq(
      'google_book_id',
      googleBookId
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as UserBook | null;
}

export async function saveUserBook(
  input: SaveUserBookInput
) {
  const userId =
    await getCurrentUserId();

  const now =
    new Date().toISOString();

  const existing =
    await getUserBook(
      input.googleBookId
    );

  let startedAt =
    existing?.started_at ??
    null;

  let finishedAt =
    existing?.finished_at ??
    null;

  if (
    input.status ===
      'reading' &&
    !startedAt
  ) {
    startedAt = now;
  }

  if (
    input.status ===
      'read'
  ) {
    if (!startedAt) {
      startedAt = now;
    }

    if (!finishedAt) {
      finishedAt = now;
    }
  }

  if (
    input.status !==
      'read'
  ) {
    finishedAt = null;
  }

  const {
    data,
    error,
  } = await supabase
    .from('user_books')
    .upsert(
      {
        user_id:
          userId,

        google_book_id:
          input.googleBookId,

        title:
          input.title,

        authors:
          input.authors ?? [],

        cover_url:
          input.coverUrl ??
          null,

        isbn:
          input.isbn ??
          null,

        published_date:
          input.publishedDate ??
          null,

        status:
          input.status,

        started_at:
          startedAt,

        finished_at:
          finishedAt,

        updated_at:
          now,
      },
      {
        onConflict:
          'user_id,google_book_id',
      }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as UserBook;
}

export async function removeUserBook(
  googleBookId: string
) {
  const userId =
    await getCurrentUserId();

  const {
    error,
  } = await supabase
    .from('user_books')
    .delete()
    .eq(
      'user_id',
      userId
    )
    .eq(
      'google_book_id',
      googleBookId
    );

  if (error) {
    throw error;
  }
}

export async function getUserBooks(
  status?: UserBookStatus
) {
  const userId =
    await getCurrentUserId();

  let query =
    supabase
      .from('user_books')
      .select('*')
      .eq(
        'user_id',
        userId
      )
      .order(
        'updated_at',
        {
          ascending: false,
        }
      );

  if (status) {
    query =
      query.eq(
        'status',
        status
      );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw error;
  }

  return (
    data ?? []
  ) as UserBook[];
}

export async function updateBookReview(
  googleBookId: string,
  rating: number | null,
  reviewText: string | null
) {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } = await supabase
    .from('user_books')
    .update({
      rating,
      review_text:
        reviewText,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      'user_id',
      userId
    )
    .eq(
      'google_book_id',
      googleBookId
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as UserBook;
}