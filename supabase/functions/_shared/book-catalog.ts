import type {
  SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_PROVIDER =
  'google_books';

const WORK_IDENTITY_VERSION =
  1;

type GoogleBookItem = {
  id?: unknown;
  volumeInfo?: {
    title?: unknown;
    subtitle?: unknown;
    authors?: unknown;
    publisher?: unknown;
    publishedDate?: unknown;
    industryIdentifiers?: unknown;
    pageCount?: unknown;
    imageLinks?: unknown;
    language?: unknown;
  };
  saleInfo?: {
    country?: unknown;
  };
  [key: string]:
    unknown;
};

type PreparedCatalogBook = {
  googleBookId: string;
  workKey: string;
  workTitle: string;
  primaryAuthor:
    string | null;
  normalizedWorkTitle: string;
  normalizedPrimaryAuthor: string;
  title: string;
  subtitle:
    string | null;
  authors: string[];
  publisher:
    string | null;
  publishedDate:
    string | null;
  isbn10:
    string | null;
  isbn13:
    string | null;
  pageCount:
    number | null;
  language:
    string | null;
  saleCountry:
    string | null;
  coverUrl:
    string | null;
  imageLinks:
    Record<
      string,
      unknown
    > | null;
  metadata:
    GoogleBookItem;
};

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return Boolean(
    value &&
    typeof value ===
      'object' &&
    !Array.isArray(
      value
    )
  );
}

function cleanString(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value.trim()
    : '';
}

function nullableString(
  value: unknown
) {
  const cleaned =
    cleanString(
      value
    );

  return cleaned ||
    null;
}

function normalizeText(
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

function canonicalWorkTitle(
  value?: string | null
) {
  if (!value) {
    return '';
  }

  let raw =
    value
      .normalize(
        'NFKD'
      )
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

  let title =
    normalizeText(
      raw
    );

  const removableSuffixes = [
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
    ' uncut edition',
    ' illustrated edition',
    ' gift edition',
    ' ebook edition',
    ' kindle edition',
    ' trade paperback',
    ' a novel',
  ];

  let changed =
    true;

  while (changed) {
    changed =
      false;

    for (
      const suffix of
        removableSuffixes
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

  return title;
}

function canonicalWorkTitleForBook(
  title: string,
  primaryAuthor:
    string | null
) {
  let normalizedTitle =
    canonicalWorkTitle(
      title
    );

  const normalizedAuthor =
    normalizeText(
      primaryAuthor
    );

  if (
    normalizedTitle &&
    normalizedAuthor
  ) {
    const authorPrefix =
      `${normalizedAuthor} s `;

    if (
      normalizedTitle.startsWith(
        authorPrefix
      )
    ) {
      normalizedTitle =
        normalizedTitle
          .slice(
            authorPrefix.length
          )
          .trim();
    }
  }

  return normalizedTitle;
}

function normalizeIsbn(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
        .replace(
          /[^0-9Xx]/g,
          ''
        )
        .toUpperCase()
    : '';
}

function extractIsbns(
  value: unknown
) {
  let isbn10:
    string | null =
    null;

  let isbn13:
    string | null =
    null;

  if (
    !Array.isArray(
      value
    )
  ) {
    return {
      isbn10,
      isbn13,
    };
  }

  for (
    const candidate of
      value
  ) {
    if (
      !isRecord(
        candidate
      )
    ) {
      continue;
    }

    const type =
      cleanString(
        candidate.type
      )
        .toUpperCase();

    const identifier =
      normalizeIsbn(
        candidate.identifier
      );

    if (
      type ===
        'ISBN_13' &&
      identifier.length ===
        13
    ) {
      isbn13 =
        isbn13 ??
        identifier;
    }

    if (
      type ===
        'ISBN_10' &&
      identifier.length ===
        10
    ) {
      isbn10 =
        isbn10 ??
        identifier;
    }
  }

  return {
    isbn10,
    isbn13,
  };
}

function extractAuthors(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .map(
      cleanString
    )
    .filter(
      Boolean
    );
}

function extractImageLinks(
  value: unknown
) {
  if (
    !isRecord(
      value
    )
  ) {
    return null;
  }

  return value;
}

function bestEditionCover(
  imageLinks:
    Record<
      string,
      unknown
    > | null
) {
  if (!imageLinks) {
    return null;
  }

  for (
    const key of [
      'extraLarge',
      'large',
      'medium',
      'thumbnail',
      'small',
      'smallThumbnail',
    ]
  ) {
    const candidate =
      nullableString(
        imageLinks[
          key
        ]
      );

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function payloadBooks(
  payload: unknown
) {
  if (
    isRecord(
      payload
    ) &&
    Array.isArray(
      payload.items
    )
  ) {
    return payload.items;
  }

  if (
    isRecord(
      payload
    ) &&
    typeof payload.id ===
      'string'
  ) {
    return [
      payload,
    ];
  }

  return [];
}

function prepareBook(
  value: unknown
):
  | PreparedCatalogBook
  | null {
  if (
    !isRecord(
      value
    )
  ) {
    return null;
  }

  const book =
    value as
      GoogleBookItem;

  const googleBookId =
    cleanString(
      book.id
    );

  const volumeInfo =
    isRecord(
      book.volumeInfo
    )
      ? book.volumeInfo
      : {};

  const title =
    cleanString(
      volumeInfo.title
    );

  if (
    !googleBookId ||
    !title
  ) {
    return null;
  }

  const authors =
    extractAuthors(
      volumeInfo.authors
    );

  const primaryAuthor =
    authors[0] ??
    null;

  const normalizedWorkTitle =
    canonicalWorkTitleForBook(
      title,
      primaryAuthor
    );

  if (
    !normalizedWorkTitle
  ) {
    return null;
  }

  const normalizedPrimaryAuthor =
    normalizeText(
      primaryAuthor
    );

  const workKey =
    `${normalizedWorkTitle}::${normalizedPrimaryAuthor}`;

  const {
    isbn10,
    isbn13,
  } =
    extractIsbns(
      volumeInfo
        .industryIdentifiers
    );

  const pageCountValue =
    volumeInfo.pageCount;

  const pageCount =
    typeof pageCountValue ===
      'number' &&
    Number.isFinite(
      pageCountValue
    ) &&
    pageCountValue >
      0
      ? Math.trunc(
          pageCountValue
        )
      : null;

  const imageLinks =
    extractImageLinks(
      volumeInfo.imageLinks
    );

  return {
    googleBookId,
    workKey,
    workTitle:
      title,
    primaryAuthor,
    normalizedWorkTitle,
    normalizedPrimaryAuthor,
    title,
    subtitle:
      nullableString(
        volumeInfo.subtitle
      ),
    authors,
    publisher:
      nullableString(
        volumeInfo.publisher
      ),
    publishedDate:
      nullableString(
        volumeInfo
          .publishedDate
      ),
    isbn10,
    isbn13,
    pageCount,
    language:
      nullableString(
        volumeInfo.language
      ),
    saleCountry:
      isRecord(
        book.saleInfo
      )
        ? nullableString(
            book.saleInfo
              .country
          )
        : null,
    coverUrl:
      bestEditionCover(
        imageLinks
      ),
    imageLinks,
    metadata:
      book,
  };
}

export async function recordGoogleBooksInCatalog(
  supabaseAdmin:
    SupabaseClient,
  payload: unknown,
  detailComplete: boolean
) {
  try {
    const prepared =
      payloadBooks(
        payload
      )
        .map(
          prepareBook
        )
        .filter(
          (
            book
          ): book is PreparedCatalogBook =>
            Boolean(
              book
            )
        );

    if (
      prepared.length ===
        0
    ) {
      return;
    }

    const uniqueWorks =
      Array.from(
        new Map(
          prepared.map(
            (
              book
            ) => [
              book.workKey,
              {
                work_key:
                  book.workKey,
                identity_version:
                  WORK_IDENTITY_VERSION,
                title:
                  book.workTitle,
                primary_author:
                  book.primaryAuthor,
                normalized_title:
                  book.normalizedWorkTitle,
                normalized_primary_author:
                  book.normalizedPrimaryAuthor,
              },
            ]
          )
        ).values()
      );

    const {
      error:
        workUpsertError,
    } =
      await supabaseAdmin
        .from(
          'book_works'
        )
        .upsert(
          uniqueWorks,
          {
            onConflict:
              'work_key',
            ignoreDuplicates:
              true,
          }
        );

    if (
      workUpsertError
    ) {
      console.warn(
        'Could not update Novori book works catalog:',
        workUpsertError.message
      );
      return;
    }

    const workKeys =
      uniqueWorks.map(
        (
          work
        ) =>
          work.work_key
      );

    const {
      data:
        workRows,
      error:
        workReadError,
    } =
      await supabaseAdmin
        .from(
          'book_works'
        )
        .select(
          'id, work_key'
        )
        .in(
          'work_key',
          workKeys
        );

    if (
      workReadError
    ) {
      console.warn(
        'Could not read Novori book works catalog:',
        workReadError.message
      );
      return;
    }

    const workIds =
      new Map<
        string,
        string
      >(
        (
          workRows ??
          []
        ).map(
          (
            row
          ) => [
            row.work_key as
              string,
            row.id as
              string,
          ]
        )
      );

    const providerIds =
      prepared.map(
        (
          book
        ) =>
          book.googleBookId
      );

    const {
      data:
        existingEditions,
      error:
        editionReadError,
    } =
      await supabaseAdmin
        .from(
          'book_editions'
        )
        .select(
          'provider_book_id, detail_complete'
        )
        .eq(
          'provider',
          GOOGLE_PROVIDER
        )
        .in(
          'provider_book_id',
          providerIds
        );

    if (
      editionReadError
    ) {
      console.warn(
        'Could not read Novori book editions catalog:',
        editionReadError.message
      );
      return;
    }

    const completeIds =
      new Set(
        (
          existingEditions ??
          []
        )
          .filter(
            (
              row
            ) =>
              row.detail_complete ===
                true
          )
          .map(
            (
              row
            ) =>
              row.provider_book_id as
                string
          )
      );

    const now =
      new Date()
        .toISOString();

    const editions =
      prepared
        .filter(
          (
            book
          ) =>
            detailComplete ||
            !completeIds.has(
              book.googleBookId
            )
        )
        .map(
          (
            book
          ) => {
            const workId =
              workIds.get(
                book.workKey
              );

            if (!workId) {
              return null;
            }

            return {
              work_id:
                workId,
              provider:
                GOOGLE_PROVIDER,
              provider_book_id:
                book.googleBookId,
              isbn_10:
                book.isbn10,
              isbn_13:
                book.isbn13,
              title:
                book.title,
              subtitle:
                book.subtitle,
              authors:
                book.authors,
              publisher:
                book.publisher,
              published_date:
                book.publishedDate,
              language:
                book.language,
              page_count:
                book.pageCount,
              sale_country:
                book.saleCountry,
              cover_url:
                book.coverUrl,
              image_links:
                book.imageLinks,
              metadata:
                book.metadata,
              detail_complete:
                detailComplete,
              source_fetched_at:
                now,
              updated_at:
                now,
            };
          }
        )
        .filter(
          (
            edition
          ): edition is NonNullable<
            typeof edition
          > =>
            Boolean(
              edition
            )
        );

    if (
      editions.length ===
        0
    ) {
      return;
    }

    const {
      error:
        editionUpsertError,
    } =
      await supabaseAdmin
        .from(
          'book_editions'
        )
        .upsert(
          editions,
          {
            onConflict:
              'provider,provider_book_id',
          }
        );

    if (
      editionUpsertError
    ) {
      console.warn(
        'Could not update Novori book editions catalog:',
        editionUpsertError.message
      );
    }
  } catch (
    error
  ) {
    // Catalog building is intentionally best effort in Phase 5.
    // It must never block the existing book experience.
    console.warn(
      'Novori book catalog ingestion failed:',
      error
    );
  }
}
