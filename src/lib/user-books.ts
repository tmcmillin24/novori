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
  return url?.replace(
    'http://',
    'https://'
  ) ??
    null;
}

function getCoverUrlQuality(
  url?: string | null
) {
  if (
    !url
  ) {
    return 0;
  }

  const lower =
    url.toLowerCase();

  if (
    lower.includes(
      'printsec=frontcover'
    )
  ) {
    return 10;
  }

  if (
    lower.includes(
      'printsec='
    ) &&
    !lower.includes(
      'printsec=frontcover'
    )
  ) {
    return -100;
  }

  try {
    const parsed =
      new URL(
        url
      );

    const zoom =
      Number(
        parsed.searchParams.get(
          'zoom'
        ) ??
        ''
      );

    if (
      Number.isFinite(
        zoom
      )
    ) {
      return zoom;
    }
  } catch {
    // Non-Google image URLs can still be high quality.
  }

  return 5;
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

  const suffixes = [
    ' limited edition',
    ' deluxe edition',
    ' special edition',
    ' collectors edition',
    ' collector s edition',
    ' exclusive edition',
    ' anniversary edition',
    ' hardcover edition',
    ' paperback edition',
    ' international edition',
    ' movie tie in edition',
    ' tv tie in edition',
    ' mass market paperback',
    ' large print edition',
    ' illustrated edition',
    ' ebook edition',
    ' kindle edition',
    ' trade paperback',
    ' a novel',
    ' a thriller',
    ' a memoir',
  ];

  let changed =
    true;

  while (
    changed
  ) {
    changed =
      false;

    for (
      const suffix of
        suffixes
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

        changed =
          true;
      }
    }
  }

  title =
    title
      .replace(
        /^(?:the|a|an)\s+/,
        ''
      )
      .replace(
        /\s+(?:book|volume|vol)\s*(?:one|1)$/,
        ''
      )
      .trim();

  const author =
    normalizeWorkText(
      book.authors?.[0]
    );

  const authorIdentity =
    author
      .split(
        ' '
      )
      .filter(Boolean)
      .sort()
      .join(
        ' '
      );

  if (
    !title ||
    !authorIdentity
  ) {
    return null;
  }

  return `${title}::${authorIdentity}`;
}

function getCatalogWorkKey(
  metadata: unknown
) {
  if (
    !metadata ||
    typeof metadata !==
      'object'
  ) {
    return null;
  }

  const key =
    (
      metadata as {
        novoriWork?: {
          key?: unknown;
        };
      }
    ).novoriWork?.key;

  return typeof key ===
    'string'
    ? key
    : null;
}

function getCatalogCoverQuality(
  metadata: unknown
) {
  const cover =
    getCatalogCoverUrl(
      metadata
    );

  return {
    cover,
    quality:
      getCoverUrlQuality(
        cover
      ),
  };
}

async function overlayCatalogCovers(
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
                key
              ): key is string =>
                Boolean(
                  key
                )
            )
        )
      );

    const exactRequest =
      supabase
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

    const workRequest =
      workKeys.length >
        0
        ? supabase
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
        : Promise.resolve({
            data: [],
            error: null,
          });

    const [
      exactResult,
      workResult,
    ] =
      await Promise.all([
        exactRequest,
        workRequest,
      ]);

    const rows = [
      ...(
        exactResult.data ??
        []
      ),
      ...(
        workResult.data ??
        []
      ),
    ];

    if (
      rows.length ===
      0
    ) {
      return books;
    }

    const coversByGoogleId =
      new Map<
        string,
        string
      >();

    const coversByWorkKey =
      new Map<
        string,
        string
      >();

    for (
      const row of rows
    ) {
      const {
        cover,
        quality,
      } =
        getCatalogCoverQuality(
          row.metadata
        );

      if (
        !cover
      ) {
        continue;
      }

      const existingExact =
        coversByGoogleId.get(
          row.google_book_id
        );

      if (
        !existingExact ||
        getCoverUrlQuality(
          existingExact
        ) <
          quality
      ) {
        coversByGoogleId.set(
          row.google_book_id,
          cover
        );
      }

      const workKey =
        getCatalogWorkKey(
          row.metadata
        );

      if (
        workKey
      ) {
        const existingWork =
          coversByWorkKey.get(
            workKey
          );

        if (
          !existingWork ||
          getCoverUrlQuality(
            existingWork
          ) <
            quality
        ) {
          coversByWorkKey.set(
            workKey,
            cover
          );
        }
      }
    }

    const repaired =
      books.map(
        (
          book
        ) => {
          const workKey =
            getUserBookWorkKey(
              book
            );

          const cover =
            coversByGoogleId.get(
              book.google_book_id
            ) ??
            (
              workKey
                ? coversByWorkKey.get(
                    workKey
                  )
                : undefined
            ) ??
            book.cover_url;

          return {
            ...book,
            cover_url:
              cover,
          };
        }
      );

    const changed =
      repaired.filter(
        (
          book,
          index
        ) =>
          book.cover_url &&
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
      ).catch(
        (
          error
        ) => {
          console.warn(
            'Could not persist repaired library covers:',
            error
          );
        }
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

  const [
    overlaid,
  ] =
    await overlayCatalogCovers([
      book,
    ]);

  return overlaid ??
    book;
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

  return overlayCatalogCovers(
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
