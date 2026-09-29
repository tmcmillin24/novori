import { supabase } from './supabase';
import {
  getCanonicalBookPresentations,
} from './canonical-books';
import type {
  CanonicalBookPresentation,
} from './canonical-books';
export {
  getCanonicalBookPresentations,
} from './canonical-books';
export type {
  CanonicalBookPresentation,
} from './canonical-books';
import { fetchGoogleBooksJson } from './google-books';
import {
  searchNovoriBooks,
} from './book-search';
import {
  resolveBookCoverUrl,
  resolveOpenLibraryWorkCover,
} from './book-covers';

let libraryMutationVersion =
  0;

function markLibraryChanged() {
  libraryMutationVersion +=
    1;
}

export function getLibraryMutationVersion() {
  return libraryMutationVersion;
}

export function notifyLibraryChanged() {
  markLibraryChanged();
}

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

type ExactGoogleBook = {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];
  };
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


function applyCanonicalPresentation(
  book: UserBook,
  canonical:
    CanonicalBookPresentation
    | undefined
): UserBook {
  if (!canonical) {
    return book;
  }

  return {
    ...book,
    title:
      canonical.title ||
      book.title,
    authors:
      canonical.authors.length >
        0
        ? canonical.authors
        : book.authors,
    cover_url:
      canonical.coverUrl ??
      book.cover_url,
    isbn:
      canonical.isbn ??
      book.isbn,
    published_date:
      canonical.publishedDate ??
      book.published_date,
  };
}

async function remoteCoverExists(
  url?: string | null
) {
  if (
    !url
  ) {
    return false;
  }

  try {
    const response =
      await fetch(
        url,
        {
          method:
            'HEAD',
        }
      );

    if (
      response.ok
    ) {
      return true;
    }

    if (
      response.status !==
        405
    ) {
      return false;
    }

    const fallback =
      await fetch(
        url
      );

    return fallback.ok;
  } catch {
    return false;
  }
}

function getExactGoogleCoverUrls(
  imageLinks:
    | ExactGoogleBook[
        'volumeInfo'
      ]['imageLinks']
    | undefined
) {
  return [
    imageLinks?.extraLarge,
    imageLinks?.large,
    imageLinks?.medium,
    imageLinks?.small,
    imageLinks?.thumbnail,
    imageLinks?.smallThumbnail,
  ]
    .map(
      secureCoverUrl
    )
    .filter(
      (
        value
      ): value is string =>
        Boolean(
          value
        )
    );
}

function getStrongExactGoogleCover(
  imageLinks:
    | ExactGoogleBook[
        'volumeInfo'
      ]['imageLinks']
    | undefined
) {
  return secureCoverUrl(
    imageLinks?.extraLarge ??
    imageLinks?.large
  );
}

function getAnyExactGoogleCover(
  imageLinks:
    | ExactGoogleBook[
        'volumeInfo'
      ]['imageLinks']
    | undefined
) {
  return secureCoverUrl(
    imageLinks?.extraLarge ??
    imageLinks?.large ??
    imageLinks?.medium ??
    imageLinks?.small ??
    imageLinks?.thumbnail ??
    imageLinks?.smallThumbnail
  );
}

function isGoogleCoverUrl(
  url?: string | null
) {
  const secure =
    secureCoverUrl(
      url
    );

  if (
    !secure
  ) {
    return false;
  }

  try {
    const host =
      new URL(
        secure
      ).hostname;

    return (
      host.includes(
        'google'
      ) ||
      host.includes(
        'ggpht'
      )
    );
  } catch {
    return false;
  }
}

function googleCoverIdentity(
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

    const id =
      parsed.searchParams.get(
        'id'
      );

    const printsec =
      parsed.searchParams.get(
        'printsec'
      );

    if (
      id
    ) {
      return `id:${id}:printsec:${printsec ?? ''}`;
    }

    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return secure.split(
      '?'
    )[0];
  }
}

function isOpenLibraryCoverUrl(
  url?: string | null
) {
  const secure =
    secureCoverUrl(
      url
    );

  if (
    !secure
  ) {
    return false;
  }

  try {
    return new URL(
      secure
    ).hostname ===
      'covers.openlibrary.org';
  } catch {
    return false;
  }
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
    if (
      isOpenLibraryCoverUrl(
        incoming
      ) &&
      existingGoogle
    ) {
      return incoming;
    }

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

function getSearchCoverTier(
  url: string | null | undefined,
  imageLinks:
    | {
        smallThumbnail?: string;
        thumbnail?: string;
        small?: string;
        medium?: string;
        large?: string;
        extraLarge?: string;
      }
    | undefined
) {
  const secure =
    secureCoverUrl(
      url
    );

  if (
    !secure ||
    !imageLinks
  ) {
    return null;
  }

  const candidates = [
    {
      value:
        secureCoverUrl(
          imageLinks
            .smallThumbnail
        ),
      tier: 1,
    },
    {
      value:
        secureCoverUrl(
          imageLinks
            .thumbnail
        ),
      tier: 2,
    },
    {
      value:
        secureCoverUrl(
          imageLinks
            .small
        ),
      tier: 3,
    },
    {
      value:
        secureCoverUrl(
          imageLinks
            .medium
        ),
      tier: 4,
    },
    {
      value:
        secureCoverUrl(
          imageLinks
            .large
        ),
      tier: 5,
    },
    {
      value:
        secureCoverUrl(
          imageLinks
            .extraLarge
        ),
      tier: 6,
    },
  ];

  return (
    candidates.find(
      (
        candidate
      ) =>
        candidate.value ===
          secure
    )?.tier ??
    null
  );
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

function normalizeWorkTitle(
  value?: string | null
) {
  if (!value) {
    return '';
  }

  let raw =
    value
      .normalize('NFKD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .trim();

  raw =
    raw.replace(
      /\s*[\[(][^\])]*(?:edition|collector|deluxe|special|exclusive|anniversary|movie tie|tv tie|paperback|hardcover|mass market|large print|book\s*\d+|volume\s*\d+|vol\.?\s*\d+|series|#\s*\d+|,\s*\d+)[^\])]*[\])]/gi,
      ''
    );

  raw =
    raw.replace(
      /\s*[:\-–—]\s*(?:a novel|the novel|special edition|deluxe edition|collector'?s edition|collectors edition|anniversary edition|movie tie[- ]?in edition|tv tie[- ]?in edition|hardcover edition|paperback edition|mass market paperback|large print edition|.*(?:series|book\s*\d+|volume\s*\d+|vol\.?\s*\d+|#\s*\d+).*)$/i,
      ''
    );

  return normalizeBookText(
    raw
  );
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

  try {
    const exactResponse =
      await fetchGoogleBooksJson<
        ExactGoogleBook
      >(
        `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(
          book.google_book_id
        )}`
      );

    const exactBook =
      exactResponse.ok
        ? exactResponse.data
        : null;

    const imageLinks =
      exactBook
        ?.volumeInfo
        .imageLinks;

    const strongExactGoogleCover =
      getStrongExactGoogleCover(
        imageLinks
      );

    const anyExactGoogleCover =
      getAnyExactGoogleCover(
        imageLinks
      );

    const currentWorks =
      await remoteCoverExists(
        currentCover
      );

    // Cleanup for Open Library URLs written by the later regression:
    // restore Google only when this exact saved edition has native
    // large/extraLarge art. Otherwise preserve the fallback.
    if (
      currentWorks &&
      isOpenLibraryCoverUrl(
        currentCover
      )
    ) {
      if (
        strongExactGoogleCover &&
        await remoteCoverExists(
          strongExactGoogleCover
        )
      ) {
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
                strongExactGoogleCover,
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

        return error
          ? book
          : data as UserBook;
      }

      return book;
    }

    // Cleanup for sibling-Google covers accidentally persisted later.
    if (
      currentWorks &&
      currentCover &&
      isGoogleCoverUrl(
        currentCover
      )
    ) {
      const exactIdentities =
        new Set(
          getExactGoogleCoverUrls(
            imageLinks
          )
            .map(
              googleCoverIdentity
            )
            .filter(Boolean)
        );

      const currentIdentity =
        googleCoverIdentity(
          currentCover
        );

      if (
        currentIdentity &&
        exactIdentities.size >
          0 &&
        !exactIdentities.has(
          currentIdentity
        ) &&
        anyExactGoogleCover &&
        await remoteCoverExists(
          anyExactGoogleCover
        )
      ) {
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
                anyExactGoogleCover,
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

        return error
          ? book
          : data as UserBook;
      }

      return book;
    }

    // Healthy non-Google covers are left alone.
    if (
      currentWorks
    ) {
      return book;
    }

    // Missing/dead cover: Google first.
    if (
      anyExactGoogleCover &&
      await remoteCoverExists(
        anyExactGoogleCover
      )
    ) {
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
              anyExactGoogleCover,
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

      return error
        ? book
        : data as UserBook;
    }

    // Only a genuinely missing/dead Google cover reaches Open Library.
    const openLibraryWorkCover =
      await resolveOpenLibraryWorkCover({
        title:
          exactBook
            ?.volumeInfo
            .title ??
          book.title,
        authors:
          exactBook
            ?.volumeInfo
            .authors ??
          book.authors ??
          [],
      });

    const fallbackCover =
      secureCoverUrl(
        openLibraryWorkCover.url
      );

    if (
      !fallbackCover
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
            fallbackCover,
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

    return error
      ? book
      : data as UserBook;
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

  let book =
    data as UserBook | null;

  if (
    !book
  ) {
    const {
      data:
        candidateRows,
      error:
        candidateError,
    } =
      await supabase
        .from(
          'user_books'
        )
        .select('*')
        .eq(
          'user_id',
          userId
        );

    if (candidateError) {
      throw candidateError;
    }

    const candidates =
      (
        candidateRows ??
        []
      ) as UserBook[];

    if (
      candidates.length ===
        0
    ) {
      return null;
    }

    const canonicalCandidates =
      await getCanonicalBookPresentations([
        googleBookId,
        ...candidates.map(
          (
            candidate
          ) =>
            candidate.google_book_id
        ),
      ]);

    const targetCanonicalId =
      canonicalCandidates.get(
        googleBookId
      )?.googleBookId ??
      googleBookId;

    book =
      candidates.find(
        (
          candidate
        ) =>
          (
            canonicalCandidates.get(
              candidate.google_book_id
            )?.googleBookId ??
            candidate.google_book_id
          ) ===
            targetCanonicalId
      ) ??
      null;

    if (!book) {
      const targetCanonical =
        canonicalCandidates.get(
          googleBookId
        );

      if (targetCanonical) {
        const targetTitle =
          normalizeWorkTitle(
            targetCanonical.title
          );

        book =
          candidates.find(
            (
              candidate
            ) =>
              normalizeWorkTitle(
                candidate.title
              ) ===
                targetTitle &&
              authorsMatch(
                targetCanonical.authors,
                candidate.authors ??
                  []
              )
          ) ??
          null;
      }
    }

    if (!book) {
      return null;
    }
  }

  const canonicalBooks =
    await getCanonicalBookPresentations([
      book.google_book_id,
    ]);

  const canonicalBook =
    canonicalBooks.get(
      book.google_book_id
    );

  if (canonicalBook) {
    return applyCanonicalPresentation(
      book,
      canonicalBook
    );
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

  // List reads stay fast: one server-side batch lookup normalizes
  // presentation to Novori's canonical work while preserving the original
  // saved google_book_id for statuses, reviews, journeys, and notes.
  const books =
    (
      data ??
      []
    ) as UserBook[];

  const canonicalBooks =
    await getCanonicalBookPresentations(
      books.map(
        (
          book
        ) =>
          book.google_book_id
      )
    );

  if (
    canonicalBooks.size ===
      0
  ) {
    return books;
  }

  return books.map(
    (
      book
    ) =>
      applyCanonicalPresentation(
        book,
        canonicalBooks.get(
          book.google_book_id
        )
      )
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
    // Selecting Read while adding/classifying a book describes
    // its state; it does not mean the user finished it today.
    // Actual journey completion is handled by the Reading Journey
    // lifecycle, which records the real completion date.
    finishedAt =
      existing?.status ===
        'read'
        ? existing.finished_at
        : null;

    dnfAt =
      null;
  }

  if (
    input.status ===
    'dnf'
  ) {
    // Initial DNF classification also carries no implied date.
    // A dated DNF journey is recorded through Reading Details.
    dnfAt =
      existing?.status ===
        'dnf'
        ? existing.dnf_at
        : null;

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

    markLibraryChanged();

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

  markLibraryChanged();

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

  markLibraryChanged();

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

  markLibraryChanged();

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

  markLibraryChanged();

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

  markLibraryChanged();
}
