import { cacheDigest, cachedHardcoverFetch, cachedProviderValue, createCacheAdmin, readProviderCache, requireReader, writeProviderCache } from '../_shared/provider-cache.ts';
import { claimApiCacheRefresh, waitForApiCacheFill } from '../_shared/api-cache-guard.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type InputBook = {
  googleBookId: string;
  title?: string;
  authors?: string[];
  isbns: string[];
};

type HardcoverAuthor = {
  name?: string | null;
  canonical?: {
    name?: string | null;
  } | null;
};

type HardcoverContribution = {
  author?: HardcoverAuthor | null;
};

type HardcoverBookCore = {
  id: number;
  title: string;
  rating: number | string | null;
  ratings_count: number;
  reviews_count: number;
  users_count: number;
  canonical_id?: number | null;
  contributions?: HardcoverContribution[];
};

type HardcoverBook = HardcoverBookCore & {
  canonical?: HardcoverBookCore | null;
  editions?: {
    isbn_10: string | null;
    isbn_13: string | null;
  }[];
};

function normalizeText(
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

function normalizeIsbn(
  value?: string | null
) {
  return (
    value
      ?.replace(
        /[^0-9Xx]/g,
        ''
      )
      .toUpperCase() ??
    ''
  );
}

function canonicalizeTitle(
  value?: string | null
) {
  let title =
    normalizeText(
      value
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
    ' uncut edition',
    ' illustrated edition',
    ' gift edition',
    ' ebook edition',
    ' kindle edition',
    ' a novel',
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

  return title;
}

function getAuthorNames(
  book:
    | HardcoverBook
    | HardcoverBookCore
) {
  return (
    book.contributions ??
    []
  )
    .flatMap(
      (
        contribution
      ) => [
        contribution.author
          ?.canonical
          ?.name,
        contribution.author
          ?.name,
      ]
    )
    .filter(
      (
        value
      ): value is string =>
        Boolean(
          value
        )
    )
    .map(
      normalizeText
    )
    .filter(Boolean);
}

function authorsMatch(
  expectedAuthors: string[],
  book:
    | HardcoverBook
    | HardcoverBookCore
) {
  if (
    expectedAuthors.length ===
    0
  ) {
    return true;
  }

  const expected =
    expectedAuthors
      .map(
        normalizeText
      )
      .filter(Boolean);

  const actual =
    getAuthorNames(
      book
    );

  if (
    actual.length ===
    0
  ) {
    return false;
  }

  return expected.some(
    (
      expectedAuthor
    ) =>
      actual.some(
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

function titlesMatch(
  expectedTitle: string,
  candidateTitle: string
) {
  const expected =
    canonicalizeTitle(
      expectedTitle
    );

  const candidate =
    canonicalizeTitle(
      candidateTitle
    );

  return Boolean(
    expected &&
    candidate &&
    (
      expected ===
        candidate ||
      expected.startsWith(
        `${candidate} `
      ) ||
      candidate.startsWith(
        `${expected} `
      )
    )
  );
}

function resolveCanonicalBook(
  book: HardcoverBook
): HardcoverBookCore {
  if (
    book.canonical &&
    book.canonical.id
  ) {
    return book.canonical;
  }

  return book;
}

function chooseBestBook(
  books: HardcoverBook[],
  title: string,
  authors: string[]
) {
  const byCanonicalId =
    new Map<
      number,
      HardcoverBookCore
    >();

  for (
    const book of
      books
  ) {
    if (
      (title && !titlesMatch(
        title,
        book.title
      )) ||
      !authorsMatch(
        authors,
        book
      )
    ) {
      continue;
    }

    const resolved =
      resolveCanonicalBook(
        book
      );

    if (
      title && !titlesMatch(
        title,
        resolved.title
      ) &&
      resolved.id !==
        book.id
    ) {
      continue;
    }

    const existing =
      byCanonicalId.get(
        resolved.id
      );

    if (
      !existing ||
      (
        resolved.ratings_count ??
        0
      ) >
        (
          existing.ratings_count ??
          0
        )
    ) {
      byCanonicalId.set(
        resolved.id,
        resolved
      );
    }
  }

  return Array.from(
    byCanonicalId.values()
  ).sort(
    (
      a,
      b
    ) =>
      (
        b.ratings_count ??
        0
      ) -
        (
          a.ratings_count ??
          0
        ) ||
      (
        b.users_count ??
        0
      ) -
        (
          a.users_count ??
          0
        ) ||
      (
        b.reviews_count ??
        0
      ) -
        (
          a.reviews_count ??
          0
        )
  )[0];
}

async function hardcoverRequest(admin: ReturnType<typeof createCacheAdmin>, token: string, query: string, variables: Record<string, unknown>, onCacheRead?: (row: any) => void) {
  const response = await cachedHardcoverFetch(admin, 'https://api.hardcover.app/v1/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  }, 86400000, 3 * 86400000, 'hardcover_popularity', onCacheRead);
  return response.json();
}

function parseSearchBooks(results: any): HardcoverBook[] {
  return (Array.isArray(results?.hits) ? results.hits : []).map((hit: any) => {
    const result = hit?.document;
    if (!result?.id || !result.title) return null;
    return {
      id: Number(result.id), title: String(result.title), rating: result.rating == null ? null : Number(result.rating),
      ratings_count: Number(result.ratings_count ?? 0), reviews_count: Number(result.reviews_count ?? 0),
      users_count: Number(result.users_count ?? 0), canonical_id: result.canonical_id == null ? null : Number(result.canonical_id),
      contributions: (Array.isArray(result.author_names) ? result.author_names : []).map((name: string) => ({ author: { name, canonical: null } })),
    };
  }).filter(Boolean);
}

type Popularity = { usersCount: number; rating: number | null; ratingsCount: number; reviewsCount: number; hardcoverBookId: number };
function cachedPopularity(row: any): Popularity | null {
  const value = row?.response_json;
  return value?.kind === 'book_popularity' ? value.value : value;
}
function toPopularity(best: HardcoverBookCore): Popularity {
  const rating = best.rating == null ? null : Number(best.rating);
  return { usersCount: Number(best.users_count ?? 0), rating: rating !== null && Number.isFinite(rating) ? rating : null,
    ratingsCount: Number(best.ratings_count ?? 0), reviewsCount: Number(best.reviews_count ?? 0), hardcoverBookId: best.id };
}

const bookFields = `
  id
  title
  rating
  ratings_count
  reviews_count
  users_count
  canonical_id
  contributions {
    author {
      name
      canonical {
        name
      }
    }
  }
  canonical {
    id
    title
    rating
    ratings_count
    reviews_count
    users_count
    canonical_id
    contributions {
      author {
        name
        canonical {
          name
        }
      }
    }
  }
`;

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const respond = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
  try {
    const admin = createCacheAdmin();
    await requireReader(admin, request);
    const token = Deno.env.get('HARDCOVER_API_TOKEN') ?? Deno.env.get('HARDCOVER_API_KEY') ?? Deno.env.get('HARDCOVER_TOKEN');
    if (!token) throw new Error('Hardcover API token is not configured.');
    const body = await request.json();
    const allowTitleFallback = body?.allowTitleFallback === true;
    const books = (Array.isArray(body?.books) ? body.books : []).slice(0, 40).map((book: any) => ({
      googleBookId: String(book?.googleBookId ?? ''), title: String(book?.title ?? '').trim(),
      authors: (Array.isArray(book?.authors) ? book.authors : []).filter((author: any) => typeof author === 'string' && author.trim()).map((author: string) => author.trim()),
      isbns: Array.from(new Set<string>((Array.isArray(book?.isbns) ? book.isbns : []).map(normalizeIsbn).filter(Boolean))),
    })).filter((book: InputBook) => book.googleBookId && (book.isbns.length || (allowTitleFallback && book.title)));
    if (!books.length) return respond({ popularity: {} });
    const provider = 'hardcover_popularity';
    let sourceExpiresAt = Infinity;
    const noteSource = (row: any) => { sourceExpiresAt = Math.min(sourceExpiresAt, Date.parse(row.expires_at)); };
    const freshMs = 86400000, staleMs = 3 * freshMs;
    // Older work/batch entries can contain ratings for a provider box set
    // mislabeled as its first novel. Rebuild popularity once with clean identities;
    // ISBNdb response caches and all TTLs remain unchanged.
    const prepared = await Promise.all(books.map(async (book: InputBook) => {
      const identity = { title: canonicalizeTitle(book.title), authors: (book.authors ?? []).map(normalizeText).sort() };
      return { book, key: 'book:v2:' + await cacheDigest({ ...identity, isbns: book.isbns.slice().sort(), allowTitleFallback }),
        workKey: identity.title && identity.authors.length ? 'work:v2:' + await cacheDigest(identity) : null };
    }));
    const batchKey = 'popularity:v3:' + await cacheDigest({ allowTitleFallback, books: books.slice().sort((a: InputBook, b: InputBook) => a.googleBookId.localeCompare(b.googleBookId)) });
    const payload = await cachedProviderValue({ admin, provider, key: batchKey, freshMs, staleMs, leaseSeconds: 90, sourceExpiresAt: () => sourceExpiresAt, load: async () => {
      const popularity: Record<string, Popularity> = {};
      const pending: typeof prepared = [], waiting: typeof prepared = [];
      for (const item of prepared) {
        const work = item.workKey ? await readProviderCache(admin, provider, item.workKey) : null;
        const cached = work && Date.parse(work.expires_at) > Date.now() ? work : await readProviderCache(admin, provider, item.key);
        if (cached && Date.parse(cached.expires_at) > Date.now()) {
          noteSource(cached);
          const result = cachedPopularity(cached);
          if (result) popularity[item.book.googleBookId] = result;
          continue;
        }
        const claim = await claimApiCacheRefresh(admin, provider, item.key, crypto.randomUUID(), 60);
        (claim.acquired ? pending : waiting).push(item);
      }
      const allIsbns = Array.from(new Set<string>(pending.flatMap(item => item.book.isbns))).sort();
      let isbnBooks: HardcoverBook[] = [];
      if (allIsbns.length) {
        const response = await hardcoverRequest(admin, token, `query HardcoverByIsbn($isbns: [String!]!) {
          books(where: { editions: { _or: [{ isbn_10: { _in: $isbns } }, { isbn_13: { _in: $isbns } }] } }) {
            ${bookFields} editions { isbn_10 isbn_13 }
          }
        }`, { isbns: allIsbns }, noteSource);
        isbnBooks = Array.isArray(response?.data?.books) ? response.data.books : [];
      }
      const matches = new Map<string, HardcoverBookCore>();
      for (const item of pending) {
        const wanted = new Set(item.book.isbns);
        const best = chooseBestBook(isbnBooks.filter(book => book.editions?.some(edition =>
          wanted.has(normalizeIsbn(edition.isbn_10)) || wanted.has(normalizeIsbn(edition.isbn_13))
        )), item.book.title ?? '', item.book.authors ?? []);
        if (best) matches.set(item.key, best);
      }
      const titleMisses = pending.filter(item => !matches.has(item.key) && allowTitleFallback && item.book.title);
      if (titleMisses.length) {
        // Up to forty title searches travel in one GraphQL request, rather than forty API pulls.
        const variables: Record<string, string> = {};
        const definitions: string[] = [], fields: string[] = [];
        titleMisses.forEach((item, index) => {
          const variable = 'query' + index;
          variables[variable] = [item.book.title, item.book.authors?.[0]].filter(Boolean).join(' ');
          definitions.push('$' + variable + ': String!');
          fields.push(`book${index}: search(query: $${variable}, query_type: "Book", per_page: 50, page: 1,
            fields: "title,author_names,isbns,alternative_titles", weights: "5,4,5,1", typos: "2,2,0,2",
            sort: "_text_match:desc,ratings_count:desc") { results }`);
        });
        const response = await hardcoverRequest(admin, token, `query HardcoverSearchBatch(${definitions.join(',')}) { ${fields.join('\n')} }`, variables, noteSource);
        titleMisses.forEach((item, index) => {
          const best = chooseBestBook(parseSearchBooks(response?.data?.['book' + index]?.results), item.book.title ?? '', item.book.authors ?? []);
          if (best) matches.set(item.key, best);
        });
      }
      for (const item of pending) {
        const best = matches.get(item.key);
        const result = best ? toPopularity(best) : null;
        // Null is a confirmed no-match and is cached too. Errors never become no-matches.
        await writeProviderCache(admin, provider, item.key, { kind: 'book_popularity', value: result }, freshMs, staleMs, sourceExpiresAt);
        if (result) {
          popularity[item.book.googleBookId] = result;
          if (item.workKey) await writeProviderCache(admin, provider, item.workKey, result, freshMs, staleMs, sourceExpiresAt);
        }
      }
      for (const item of waiting) {
        const cached = await waitForApiCacheFill(admin, provider, item.key);
        if (!cached) {
          const busy = new Error('Provider refresh is already in progress.');
          busy.name = 'CacheRefreshBusy';
          throw busy;
        }
        noteSource(cached);
        const result = cachedPopularity(cached);
        if (result) popularity[item.book.googleBookId] = result;
      }
      return { popularity };
    } });
    return respond(payload);
  } catch (error) {
    console.error('hardcover-search-popularity failed:', error);
    return respond({ error: error instanceof Error ? error.message : 'Could not load Hardcover popularity.' }, 503);
  }
});
