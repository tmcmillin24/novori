import type {
  SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_PROVIDER =
  'google_books';

export type CanonicalGoogleEdition = {
  workId: string;
  editionId: string;
  googleBookId: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  isbn10: string | null;
  isbn13: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  language: string | null;
  saleCountry: string | null;
  coverUrl: string | null;
  imageLinks:
    | Record<string, string>
    | null;
  detailComplete: boolean;
};

type WorkRow = {
  id: string;
  normalized_title:
    string;
  normalized_primary_author:
    string;
};

type EditionRow = {
  id: string;
  work_id: string;
  provider_book_id: string;
  isbn_10: string | null;
  isbn_13: string | null;
  title: string | null;
  subtitle: string | null;
  authors: unknown;
  published_date:
    string | null;
  language: string | null;
  page_count: number | null;
  sale_country: string | null;
  cover_url: string | null;
  image_links: unknown;
  detail_complete:
    boolean | null;
};

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

function secureUrl(
  value?: string | null
) {
  const cleaned =
    value?.trim() ??
    '';

  return cleaned
    ? cleaned.replace(
        /^http:\/\//i,
        'https://'
      )
    : null;
}

function cleanAuthors(
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
    .filter(
      (
        author
      ): author is string =>
        typeof author ===
          'string'
    )
    .map(
      (
        author
      ) =>
        author.trim()
    )
    .filter(Boolean);
}

function cleanImageLinks(
  value: unknown
) {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  const output:
    Record<
      string,
      string
    > = {};

  for (
    const [
      key,
      entry,
    ] of Object.entries(
      value
    )
  ) {
    if (
      typeof entry ===
        'string' &&
      entry.trim()
    ) {
      output[key] =
        entry.replace(
          /^http:\/\//i,
          'https://'
        );
    }
  }

  return Object.keys(
    output
  ).length >
    0
    ? output
    : null;
}

function localeScore(
  edition:
    EditionRow
) {
  const language =
    (
      edition.language ??
      ''
    )
      .trim()
      .toLowerCase();

  const country =
    (
      edition.sale_country ??
      ''
    )
      .trim()
      .toUpperCase();

  const isEnglish =
    language ===
      'en' ||
    language ===
      'eng' ||
    language.startsWith(
      'en-'
    );

  if (
    language &&
    !isEnglish
  ) {
    return null;
  }

  if (
    isEnglish &&
    country ===
      'US'
  ) {
    return 300;
  }

  if (isEnglish) {
    return 250;
  }

  if (
    !language &&
    country ===
      'US'
  ) {
    return 200;
  }

  return 100;
}

function editionScore(
  edition:
    EditionRow,
  work:
    WorkRow
) {
  const locale =
    localeScore(
      edition
    );

  if (
    locale ===
      null ||
    !edition.provider_book_id
  ) {
    return null;
  }

  const exactCleanTitle =
    normalizeText(
      edition.title
    ) ===
      work.normalized_title;

  const authors =
    cleanAuthors(
      edition.authors
    );

  const authorMatches =
    !work.normalized_primary_author ||
    authors.some(
      (
        author
      ) => {
        const normalized =
          normalizeText(
            author
          );

        return (
          normalized ===
            work.normalized_primary_author ||
          normalized.includes(
            work.normalized_primary_author
          ) ||
          work.normalized_primary_author.includes(
            normalized
          )
        );
      }
    );

  if (!authorMatches) {
    return null;
  }

  return (
    (
      exactCleanTitle
        ? 1000
        : 0
    ) +
    locale +
    (
      edition.detail_complete
        ? 100
        : 0
    ) +
    (
      edition.cover_url
        ? 20
        : 0
    ) +
    (
      (
        edition.page_count ??
        0
      ) >
        0
        ? 10
        : 0
    )
  );
}

export async function getCanonicalGoogleEditionsForWorkIds(
  supabaseAdmin:
    SupabaseClient,
  workIds:
    string[]
) {
  const uniqueWorkIds =
    Array.from(
      new Set(
        workIds.filter(
          Boolean
        )
      )
    );

  const result =
    new Map<
      string,
      CanonicalGoogleEdition
    >();

  if (
    uniqueWorkIds.length ===
      0
  ) {
    return result;
  }

  const {
    data:
      workRows,
    error:
      workError,
  } =
    await supabaseAdmin
      .from(
        'book_works'
      )
      .select(
        'id, normalized_title, normalized_primary_author'
      )
      .in(
        'id',
        uniqueWorkIds
      );

  if (workError) {
    throw new Error(
      'Could not read canonical Novori works: ' +
      workError.message
    );
  }

  const worksById =
    new Map<
      string,
      WorkRow
    >(
      (
        workRows ??
        []
      ).map(
        (
          row
        ) => [
          row.id as
            string,
          row as
            WorkRow,
        ]
      )
    );

  const {
    data:
      editionRows,
    error:
      editionError,
  } =
    await supabaseAdmin
      .from(
        'book_editions'
      )
      .select(
        'id, work_id, provider_book_id, isbn_10, isbn_13, title, subtitle, authors, published_date, language, page_count, sale_country, cover_url, image_links, detail_complete'
      )
      .eq(
        'provider',
        GOOGLE_PROVIDER
      )
      .in(
        'work_id',
        uniqueWorkIds
      );

  if (editionError) {
    throw new Error(
      'Could not read canonical Novori editions: ' +
      editionError.message
    );
  }

  const grouped =
    new Map<
      string,
      EditionRow[]
    >();

  for (
    const row of
      editionRows ??
      []
  ) {
    const edition =
      row as
        EditionRow;

    const existing =
      grouped.get(
        edition.work_id
      ) ??
      [];

    existing.push(
      edition
    );

    grouped.set(
      edition.work_id,
      existing
    );
  }

  for (
    const workId of
      uniqueWorkIds
  ) {
    const work =
      worksById.get(
        workId
      );

    if (!work) {
      continue;
    }

    const ranked =
      (
        grouped.get(
          workId
        ) ??
        []
      )
        .map(
          (
            edition
          ) => ({
            edition,
            score:
              editionScore(
                edition,
                work
              ),
          })
        )
        .filter(
          (
            candidate
          ): candidate is {
            edition:
              EditionRow;
            score:
              number;
          } =>
            candidate.score !==
              null
        )
        .sort(
          (
            a,
            b
          ) =>
            b.score -
              a.score ||
            a.edition
              .provider_book_id
              .localeCompare(
                b.edition
                  .provider_book_id
              )
        );

    const selected =
      ranked[0]
        ?.edition;

    if (
      !selected ||
      !selected.title
    ) {
      continue;
    }

    result.set(
      workId,
      {
        workId,
        editionId:
          selected.id,
        googleBookId:
          selected.provider_book_id,
        title:
          selected.title,
        subtitle:
          selected.subtitle,
        authors:
          cleanAuthors(
            selected.authors
          ),
        isbn10:
          selected.isbn_10,
        isbn13:
          selected.isbn_13,
        publishedDate:
          selected.published_date,
        pageCount:
          selected.page_count,
        language:
          selected.language,
        saleCountry:
          selected.sale_country,
        coverUrl:
          secureUrl(
            selected.cover_url
          ),
        imageLinks:
          cleanImageLinks(
            selected.image_links
          ),
        detailComplete:
          Boolean(
            selected.detail_complete
          ),
      }
    );
  }

  return result;
}
