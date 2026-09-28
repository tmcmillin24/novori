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
  status: UserBookStatus | null;
  owned: boolean;
  rating: number | null;
  review_text: string | null;
  started_at: string | null;
  finished_at: string | null;
  dnf_at: string | null;
  created_at: string;
  updated_at: string;
};

type SaveUserBookInput = {
  googleBookId: string;
  title: string;
  authors?: string[];
  coverUrl?: string | null;
  isbn?: string | null;
  publishedDate?: string | null;
  status?: UserBookStatus | null;
  owned?: boolean;
};

type UpdateBookReviewInput = {
  googleBookId: string;
  rating: number | null;
  reviewText: string | null;
};

type UpdateBookReadingDatesInput = {
  googleBookId: string;
  startedAt: string | null;
  finishedAt: string | null;
  dnfAt: string | null;
};

function secureBookCoverUrl(
  url?: string | null
) {
  return (
    url?.replace(
      'http://',
      'https://'
    ) ??
    null
  );
}

function getGoogleCoverVolumeId(
  url?: string | null
) {
  if (!url) {
    return null;
  }

  try {
    const parsed =
      new URL(
        secureBookCoverUrl(
          url
        ) ??
          url
      );

    return parsed.searchParams.get(
      'id'
    );
  } catch {
    return null;
  }
}

function getCatalogCoverUrl(
  metadata: unknown
) {
  if (
    !metadata ||
    typeof metadata !==
      'object'
  ) {
    return null;
  }

  const links =
    (
      metadata as {
        volumeInfo?: {
          imageLinks?: {
            extraLarge?: string;
            large?: string;
            medium?: string;
            small?: string;
            thumbnail?: string;
            smallThumbnail?: string;
          };
        };
      }
    ).volumeInfo
      ?.imageLinks;

  return (
    secureBookCoverUrl(
      links?.extraLarge
    ) ??
    secureBookCoverUrl(
      links?.large
    ) ??
    secureBookCoverUrl(
      links?.medium
    ) ??
    secureBookCoverUrl(
      links?.small
    ) ??
    secureBookCoverUrl(
      links?.thumbnail
    ) ??
    secureBookCoverUrl(
      links?.smallThumbnail
    )
  );
}

function normalizeWorkText(
  value?: string | null
) {
  return (
    value ??
    ''
  )
    .toLowerCase()
    .normalize(
      'NFKD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]+/g,
      ' '
    )
    .trim();
}

function getUserBookWorkKey(
  book: UserBook
) {
  let title =
    normalizeWorkText(
      book.title
    );

  for (
    const suffix of [
      ' a novel',
      ' a thriller',
      ' a memoir',
      ' limited edition',
      ' deluxe edition',
      ' special edition',
      ' hardcover edition',
      ' paperback edition',
      ' mass market paperback',
      ' large print edition',
      ' ebook edition',
      ' kindle edition',
      ' trade paperback',
    ]
  ) {
    if (
      title.endsWith(
        suffix
      )
    ) {
      title =
        title
          .slice(
            0,
            -suffix.length
          )
          .trim();
    }
  }

  title =
    title
      .replace(
        /^(?:the|a|an)\s+/,
        ''
      )
      .trim();

  const author =
    normalizeWorkText(
      book.authors?.[0]
    );

  if (
    !title ||
    !author
  ) {
    return null;
  }

  const authorIdentity =
    author
      .split(' ')
      .filter(Boolean)
      .sort()
      .join(' ');

  return `${title}::${authorIdentity}`;
}

async function repairCatalogCovers(
  books: UserBook[]
): Promise<UserBook[]> {
  if (
    books.length ===
    0
  ) {
    return books;
  }

  try {
    const ids =
      Array.from(
        new Set(
          books.map(
            (
              book
            ) =>
              book.google_book_id
          )
        )
      );

    const workKeys =
      Array.from(
        new Set(
          books
            .map(
              getUserBookWorkKey
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(
                  value
                )
            )
        )
      );

    const exactResult =
      await supabase
        .from(
          'google_books_catalog'
        )
        .select(
          'google_book_id, metadata'
        )
        .in(
          'google_book_id',
          ids
        );

    const workResult =
      workKeys.length >
      0
        ? await supabase
            .from(
              'google_books_catalog'
            )
            .select(
              'google_book_id, metadata'
            )
            .in(
              'metadata->novoriWork->>key',
              workKeys
            )
        : {
            data: [],
            error: null,
          };

    const exactCovers =
      new Map<
        string,
        string
      >();

    const workCovers =
      new Map<
        string,
        string
      >();

    for (
      const row of
        exactResult.data ??
        []
    ) {
      const candidate =
        getCatalogCoverUrl(
          row.metadata
        );

      if (
        !candidate
      ) {
        continue;
      }

      const candidateId =
        getGoogleCoverVolumeId(
          candidate
        );

      if (
        !candidateId ||
        candidateId ===
          row.google_book_id
      ) {
        exactCovers.set(
          row.google_book_id,
          candidate
        );
      }
    }

    for (
      const row of
        workResult.data ??
        []
    ) {
      const key =
        (
          row.metadata as {
            novoriWork?: {
              key?: unknown;
            };
          }
        )?.novoriWork?.key;

      const candidate =
        getCatalogCoverUrl(
          row.metadata
        );

      if (
        typeof key ===
          'string' &&
        candidate &&
        !workCovers.has(
          key
        )
      ) {
        workCovers.set(
          key,
          candidate
        );
      }
    }

    const repaired =
      books.map(
        (
          book
        ) => {
          const currentCover =
            secureBookCoverUrl(
              book.cover_url
            );

          const currentId =
            getGoogleCoverVolumeId(
              currentCover
            );

          const exactCover =
            exactCovers.get(
              book.google_book_id
            );

          const currentIsClearlyCrossEdition =
            Boolean(
              currentId &&
              currentId !==
                book.google_book_id
            );

          let nextCover =
            currentCover;

          if (
            exactCover &&
            (
              !currentCover ||
              currentIsClearlyCrossEdition ||
              getGoogleCoverVolumeId(
                exactCover
              ) ===
                currentId
            )
          ) {
            nextCover =
              exactCover;
          } else if (
            !currentCover
          ) {
            const workKey =
              getUserBookWorkKey(
                book
              );

            nextCover =
              (
                workKey
                  ? workCovers.get(
                      workKey
                    )
                  : undefined
              ) ??
              null;
          }

          return {
            ...book,
            cover_url:
              nextCover,
          };
        }
      );

    const changed =
      repaired.filter(
        (
          book,
          index
        ) =>
          book.cover_url !==
            books[index]
              ?.cover_url
      );

    if (
      changed.length >
      0
    ) {
      void Promise.all(
        changed.map(
          (
            book
          ) =>
            supabase
              .from(
                'user_books'
              )
              .update({
                cover_url:
                  book.cover_url,
              })
              .eq(
                'id',
                book.id
              )
              .eq(
                'user_id',
                book.user_id
              )
        )
      );
    }

    return repaired;
  } catch {
    return books;
  }
}

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error('You must be signed in to manage your library.');
  }

  return user.id;
}

export async function getUserBook(
  googleBookId: string
): Promise<UserBook | null> {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } = await supabase
    .from('user_books')
    .select('*')
    .eq('user_id', userId)
    .eq(
      'google_book_id',
      googleBookId
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  const book =
    data as UserBook | null;

  if (
    !book
  ) {
    return null;
  }

  const repaired =
    await repairCatalogCovers([
      book,
    ]);

  return (
    repaired[0] ??
    book
  );
}

export async function getUserBooks(
  status?: UserBookStatus
): Promise<UserBook[]> {
  const userId =
    await getCurrentUserId();

  let query =
    supabase
      .from('user_books')
      .select('*')
      .eq('user_id', userId)
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

  return repairCatalogCovers(
    (data ?? []) as UserBook[]
  );
}

export async function saveUserBook(
  input: SaveUserBookInput
): Promise<UserBook> {
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

  let dnfAt =
    existing?.dnf_at ??
    null;

  if (
    input.status ===
    'reading'
  ) {
    startedAt =
      startedAt ?? now;

    finishedAt =
      null;

    dnfAt =
      null;
  }

  if (
    input.status ===
    'read'
  ) {
    startedAt =
      startedAt ?? now;

    if (
      existing?.status !==
      'read'
    ) {
      finishedAt =
        now;
    } else {
      finishedAt =
        finishedAt ?? now;
    }

    dnfAt =
      null;
  }

  if (
    input.status ===
    'dnf'
  ) {
    if (
      existing?.status !==
      'dnf'
    ) {
      dnfAt =
        now;
    } else {
      dnfAt =
        dnfAt ?? now;
    }

    finishedAt =
      null;
  }

  if (
    input.status ===
    'want_to_read'
  ) {
    finishedAt =
      null;

    dnfAt =
      null;
  }

  if (existing) {
    const {
      data,
      error,
    } = await supabase
      .from('user_books')
      .update({
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
          input.status ??
          existing.status,
        owned:
          input.owned ??
          existing.owned ??
          false,
        started_at:
          startedAt,
        finished_at:
          finishedAt,
        dnf_at:
          dnfAt,
        updated_at:
          now,
      })
      .eq(
        'id',
        existing.id
      )
      .eq(
        'user_id',
        userId
      )
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return data as UserBook;
  }

  const {
    data,
    error,
  } = await supabase
    .from('user_books')
    .insert({
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
        input.status ??
        null,
      owned:
        input.owned ??
        false,
      started_at:
        startedAt,
      finished_at:
        finishedAt,
      dnf_at:
        dnfAt,
      updated_at:
        now,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as UserBook;
}

export async function updateUserBookOwned(
  googleBookId: string,
  owned: boolean
): Promise<UserBook> {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } = await supabase
    .from('user_books')
    .update({
      owned,
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
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as UserBook;
}

export async function updateUserBookCover(
  googleBookId: string,
  coverUrl: string | null
): Promise<UserBook> {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } = await supabase
    .from('user_books')
    .update({
      cover_url:
        coverUrl,
    })
    .eq(
      'user_id',
      userId
    )
    .eq(
      'google_book_id',
      googleBookId
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as UserBook;
}

export async function updateBookReadingDates({
  googleBookId,
  startedAt,
  finishedAt,
  dnfAt,
}: UpdateBookReadingDatesInput): Promise<UserBook> {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } = await supabase
    .from('user_books')
    .update({
      started_at:
        startedAt,
      finished_at:
        finishedAt,
      dnf_at:
        dnfAt,
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
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as UserBook;
}

export async function updateBookReview({
  googleBookId,
  rating,
  reviewText,
}: UpdateBookReviewInput): Promise<UserBook> {
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
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as UserBook;
}

export async function removeUserBook(
  googleBookId: string
): Promise<void> {
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
