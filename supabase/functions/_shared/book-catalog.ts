import { validPageCount } from './page-count.ts';
import { samePageEdition } from './edition-pages.ts';
import type {
  SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

import {
  selectCanonicalGoogleCoversForWorkIds,
} from './book-cover-selector.ts';

const GOOGLE_PROVIDER =
  'google_books';

const WORK_IDENTITY_VERSION =
  1;

const GOOGLE_COVER_VARIANTS = [
  'extraLarge',
  'large',
  'medium',
  'small',
  'thumbnail',
  'smallThumbnail',
] as const;

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

function secureCoverUrl(
  value: unknown
) {
  const cleaned =
    nullableString(
      value
    );

  return cleaned
    ? cleaned.replace(
        /^http:\/\//i,
        'https://'
      )
    : null;
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

  const pageCount = validPageCount(volumeInfo.pageCount) ?? null;

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
  detailComplete: boolean,
  discoverySource =
    detailComplete
      ? 'google_detail'
      : 'google_search',
  provider = GOOGLE_PROVIDER
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
          'provider_book_id, detail_complete, isbn_13, page_count, metadata'
        )
        .eq(
          'provider',
          provider
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

            const previous = (existingEditions ?? []).find((row: any) => row.provider_book_id === book.googleBookId);
            const retainedPages = !book.pageCount && previous && samePageEdition(book.metadata,previous.metadata)
              ? validPageCount(previous.metadata?.volumeInfo?.pageCount) ?? validPageCount(previous.page_count) : undefined;
            const pages = book.pageCount ?? retainedPages ?? null;
            const metadata = retainedPages ? {...book.metadata,volumeInfo:{...(book.metadata as any).volumeInfo,pageCount:retainedPages}} : book.metadata;
            return {
              work_id:
                workId,
              provider:
                provider,
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
                pages,
              sale_country:
                book.saleCountry,
              cover_url:
                book.coverUrl,
              image_links:
                book.imageLinks,
              metadata:
                metadata,
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
      editions.length >
        0
    ) {
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
        return;
      }
    }

    const {
      data:
        editionRows,
      error:
        editionRowsError,
    } =
      await supabaseAdmin
        .from(
          'book_editions'
        )
        .select(
          'id, work_id, provider_book_id'
        )
        .eq(
          'provider',
          provider
        )
        .in(
          'provider_book_id',
          providerIds
        );

    if (
      editionRowsError
    ) {
      console.warn(
        'Could not read Novori editions for cover discovery:',
        editionRowsError.message
      );
      return;
    }

    const editionsByProviderId =
      new Map<
        string,
        {
          id: string;
          workId: string;
        }
      >(
        (
          editionRows ??
          []
        ).map(
          (
            row
          ) => [
            row.provider_book_id as
              string,
            {
              id:
                row.id as
                  string,
              workId:
                row.work_id as
                  string,
            },
          ]
        )
      );

    const coverCandidates:
      Record<
        string,
        unknown
      >[] =
      [];

    for (
      const book of
        prepared
    ) {
      const edition =
        editionsByProviderId.get(
          book.googleBookId
        );

      if (
        !edition ||
        !book.imageLinks
      ) {
        continue;
      }

      for (
        const variant of
          GOOGLE_COVER_VARIANTS
      ) {
        const url =
          secureCoverUrl(
            book.imageLinks[
              variant
            ]
          );

        if (!url) {
          continue;
        }

        coverCandidates.push({
          candidate_key:
            `${provider}:${book.googleBookId}:${variant}`,
          work_id:
            edition.workId,
          edition_id:
            edition.id,
          scope:
            'edition',
          provider:
            provider,
          source_kind:
            'image_link',
          source_variant:
            variant,
          external_id:
            book.googleBookId,
          url,
          discovery_source:
            discoverySource,
          source_metadata: {
            detailComplete,
            googleBookId:
              book.googleBookId,
            variant,
          },
          last_seen_at:
            now,
        });
      }
    }

    if (
      coverCandidates.length >
        0
    ) {
      const {
        error:
          coverCandidateError,
      } =
        await supabaseAdmin
          .from(
            'book_cover_candidates'
          )
          .upsert(
            coverCandidates,
            {
              onConflict:
                'candidate_key',
            }
          );

      if (
        coverCandidateError
      ) {
        console.warn(
          'Could not update Novori Google cover candidates:',
          coverCandidateError.message
        );
        return;
      }
    }

    await selectCanonicalGoogleCoversForWorkIds(
      supabaseAdmin,
      Array.from(
        new Set(
          prepared
            .map(
              (
                book
              ) =>
                workIds.get(
                  book.workKey
                )
            )
            .filter(
              (
                workId
              ): workId is string =>
                Boolean(
                  workId
                )
            )
        )
      )
    );
  } catch (
    error
  ) {
    // Catalog and candidate discovery are intentionally best effort.
    // They must never block the existing book experience.
    console.warn(
      'Novori book catalog ingestion failed:',
      error
    );
  }
}

export async function recordOpenLibraryWorkCoverCandidates(
  supabaseAdmin:
    SupabaseClient,
  {
    title,
    author,
    openLibraryWorkKey,
    coverIds,
    discoverySource =
      'open_library_work',
  }: {
    title: string;
    author: string;
    openLibraryWorkKey?:
      | string
      | null;
    coverIds: number[];
    discoverySource?: string;
  }
) {
  try {
    const validCoverIds =
      Array.from(
        new Set(
          coverIds.filter(
            (
              coverId
            ) =>
              Number.isFinite(
                coverId
              ) &&
              coverId >
                0
          )
        )
      );

    if (
      validCoverIds.length ===
        0
    ) {
      return;
    }

    const cleanTitle =
      title.trim();

    const cleanAuthor =
      author.trim();

    const normalizedTitle =
      canonicalWorkTitleForBook(
        cleanTitle,
        cleanAuthor ||
          null
      );

    if (
      !normalizedTitle
    ) {
      return;
    }

    const normalizedAuthor =
      normalizeText(
        cleanAuthor
      );

    const workKey =
      `${normalizedTitle}::${normalizedAuthor}`;

    const {
      error:
        workUpsertError,
    } =
      await supabaseAdmin
        .from(
          'book_works'
        )
        .upsert(
          {
            work_key:
              workKey,
            identity_version:
              WORK_IDENTITY_VERSION,
            title:
              cleanTitle,
            primary_author:
              cleanAuthor ||
              null,
            normalized_title:
              normalizedTitle,
            normalized_primary_author:
              normalizedAuthor,
          },
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
        'Could not prepare Novori work for Open Library covers:',
        workUpsertError.message
      );
      return;
    }

    const {
      data:
        workRow,
      error:
        workReadError,
    } =
      await supabaseAdmin
        .from(
          'book_works'
        )
        .select(
          'id'
        )
        .eq(
          'work_key',
          workKey
        )
        .maybeSingle();

    if (
      workReadError ||
      !workRow?.id
    ) {
      if (
        workReadError
      ) {
        console.warn(
          'Could not read Novori work for Open Library covers:',
          workReadError.message
        );
      }
      return;
    }

    const now =
      new Date()
        .toISOString();

    const candidates =
      validCoverIds.map(
        (
          coverId
        ) => ({
          candidate_key:
            `open_library:${workRow.id}:cover_id:${coverId}`,
          work_id:
            workRow.id,
          edition_id:
            null,
          scope:
            'work',
          provider:
            'open_library',
          source_kind:
            'cover_id',
          source_variant:
            'L',
          external_id:
            String(
              coverId
            ),
          url:
            `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`,
          discovery_source:
            discoverySource,
          source_metadata: {
            openLibraryWorkKey:
              openLibraryWorkKey ??
              null,
            coverId,
          },
          last_seen_at:
            now,
        })
      );

    const {
      error:
        candidateError,
    } =
      await supabaseAdmin
        .from(
          'book_cover_candidates'
        )
        .upsert(
          candidates,
          {
            onConflict:
              'candidate_key',
          }
        );

    if (
      candidateError
    ) {
      console.warn(
        'Could not update Novori Open Library cover candidates:',
        candidateError.message
      );
    }
  } catch (
    error
  ) {
    console.warn(
      'Novori Open Library cover discovery failed:',
      error
    );
  }
}
