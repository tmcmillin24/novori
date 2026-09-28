import { supabase } from './supabase';
import {
  getBestSearchCover,
  searchNovoriBooks,
} from './book-search';

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

function secureCoverUrl(
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

function getGoogleCoverInfo(
  url?: string | null
) {
  const secure =
    secureCoverUrl(
      url
    );

  if (
    !secure
  ) {
    return null;
  }

  try {
    const parsed =
      new URL(
        secure
      );

    if (
      !parsed.hostname.includes(
        'google'
      )
    ) {
      return null;
    }

    const zoom =
      Number(
        parsed.searchParams.get(
          'zoom'
        ) ??
        ''
      );

    return {
      id:
        parsed.searchParams.get(
          'id'
        ),
      printsec:
        parsed.searchParams.get(
          'printsec'
        ),
      zoom:
        Number.isFinite(
          zoom
        )
          ? zoom
          : null,
    };
  } catch {
    return null;
  }
}

function getSavedCoverQuality(
  url?: string | null
) {
  if (
    !url
  ) {
    return 0;
  }

  const google =
    getGoogleCoverInfo(
      url
    );

  if (
    !google
  ) {
    // Unknown/non-Google covers should never be discarded by a
    // Google thumbnail simply because their dimensions are opaque.
    return 1000;
  }

  const frontCoverBonus =
    google.printsec ===
      'frontcover'
      ? 5
      : google.printsec
        ? -50
        : 0;

  return (
    (
      google.zoom ??
      1
    ) *
      10 +
    frontCoverBonus
  );
}

function chooseSavedCover(
  existingUrl:
    string | null | undefined,
  incomingUrl:
    string | null | undefined
) {
  const existing =
    secureCoverUrl(
      existingUrl
    );

  const incoming =
    secureCoverUrl(
      incomingUrl
    );

  if (
    !incoming
  ) {
    return existing;
  }

  if (
    !existing
  ) {
    return incoming;
  }

  if (
    incoming ===
    existing
  ) {
    return existing;
  }

  const existingGoogle =
    getGoogleCoverInfo(
      existing
    );

  const incomingGoogle =
    getGoogleCoverInfo(
      incoming
    );

  if (
    !existingGoogle
  ) {
    return existing;
  }

  if (
    !incomingGoogle
  ) {
    return existing;
  }

  const sameGoogleVolume =
    Boolean(
      existingGoogle.id &&
      incomingGoogle.id &&
      existingGoogle.id ===
        incomingGoogle.id
    );

  const existingQuality =
    getSavedCoverQuality(
      existing
    );

  const incomingQuality =
    getSavedCoverQuality(
      incoming
    );

  if (
    sameGoogleVolume
  ) {
    return incomingQuality >
      existingQuality
      ? incoming
      : existing;
  }

  const existingIsClearlyLowResolution =
    existingGoogle.zoom !==
      null &&
    existingGoogle.zoom <=
      1;

  return (
    existingIsClearlyLowResolution &&
    incomingQuality >
      existingQuality
  )
    ? incoming
    : existing;
}

function normalizeBookText(
  value?: string | null
) {
  return (
    value ??
    ''
  )
    .toLowerCase()
    .normalize('NFKD')
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

function isClearlyLowResolutionGoogleCover(
  url?: string | null
) {
  if (
    !url
  ) {
    return true;
  }

  try {
    const parsed =
      new URL(
        secureCoverUrl(
          url
        ) ??
          url
      );

    if (
      !parsed.hostname.includes(
        'google'
      )
    ) {
      return false;
    }

    const zoom =
      Number(
        parsed.searchParams.get(
          'zoom'
        ) ??
        ''
      );

    return (
      Number.isFinite(
        zoom
      ) &&
      zoom > 0 &&
      zoom <= 1
    );
  } catch {
    return false;
  }
}

function authorsMatch(
  expected:
    string[],
  actual:
    string[]
) {
  if (
    expected.length ===
      0 ||
    actual.length ===
      0
  ) {
    return true;
  }

  const expectedNormalized =
    expected
      .map(
        normalizeBookText
      )
      .filter(Boolean);

  const actualNormalized =
    actual
      .map(
        normalizeBookText
      )
      .filter(Boolean);

  return expectedNormalized.some(
    (
      expectedAuthor
    ) =>
      actualNormalized.some(
        (
          actualAuthor
        ) =>
          actualAuthor ===
            expectedAuthor ||
          actualAuthor.includes(
            expectedAuthor
          ) ||
          expectedAuthor.includes(
            actualAuthor
          )
      )
  );
}

async function repairSavedCover(
  book: UserBook
): Promise<UserBook> {
  const currentCover =
    secureCoverUrl(
      book.cover_url
    );

  const currentGoogle =
    getGoogleCoverInfo(
      currentCover
    );

  const currentNeedsRepair =
    !currentCover ||
    (
      currentGoogle &&
      (
        currentGoogle.zoom ===
          null ||
        currentGoogle.zoom <=
          2
      )
    );

  if (
    !currentNeedsRepair
  ) {
    return book;
  }

  const title =
    book.title.trim();

  if (
    !title
  ) {
    return book;
  }

  try {
    const discoverResults =
      await searchNovoriBooks(
        title
      );

    const wantedTitle =
      normalizeBookText(
        book.title
      );

    const bestDiscoverMatch =
      discoverResults.find(
        (
          candidate
        ) => {
          const candidateTitle =
            normalizeBookText(
              candidate
                .volumeInfo
                .title
            );

          const titleMatches =
            candidateTitle ===
              wantedTitle ||
            candidateTitle.startsWith(
              `${wantedTitle} `
            ) ||
            wantedTitle.startsWith(
              `${candidateTitle} `
            );

          return (
            titleMatches &&
            authorsMatch(
              book.authors ??
                [],
              candidate
                .volumeInfo
                .authors ??
                []
            ) &&
            Boolean(
              getBestSearchCover(
                candidate
                  .volumeInfo
                  .imageLinks
              )
            )
          );
        }
      );

    const discoverCover =
      getBestSearchCover(
        bestDiscoverMatch
          ?.volumeInfo
          .imageLinks
      ) ??
      null;

    if (
      !discoverCover ||
      discoverCover ===
        currentCover
    ) {
      return book;
    }

    const discoverGoogle =
      getGoogleCoverInfo(
        discoverCover
      );

    const currentIsClearlyLowResolution =
      isClearlyLowResolutionGoogleCover(
        currentCover
      );

    const discoverIsHigherQuality =
      Boolean(
        currentGoogle &&
        discoverGoogle &&
        getSavedCoverQuality(
          discoverCover
        ) >
          getSavedCoverQuality(
            currentCover
          )
      );

    if (
      currentCover &&
      !currentIsClearlyLowResolution &&
      !discoverIsHigherQuality
    ) {
      return book;
    }

    const {
      data,
      error,
    } =
      await supabase
        .from(
          'user_books'
        )
        .update({
          cover_url:
            discoverCover,
        })
        .eq(
          'id',
          book.id
        )
        .eq(
          'user_id',
          book.user_id
        )
        .select('*')
        .single();

    if (
      error
    ) {
      return book;
    }

    return (
      data as UserBook
    );
  } catch {
    return book;
  }
}

async function repairSavedCovers(
  books: UserBook[]
) {
  const repaired:
    UserBook[] = [];

  for (
    const book of books
  ) {
    repaired.push(
      await repairSavedCover(
        book
      )
    );
  }

  return repaired;
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

  return repairSavedCover(
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

  return repairSavedCovers(
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
          chooseSavedCover(
            existing.cover_url,
            input.coverUrl
          ),
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
