import { hardcoverDiscoveryEligible } from '../_shared/hardcover-discovery-policy.ts';
import { normalizeBookGenres } from '../_shared/book-genres.ts';
import { verifiedEnglishSeriesArt } from '../_shared/verified-series-covers.ts';
import { englishEditionIsbns } from '../_shared/book-language.ts';
import { getServerKey } from "../_shared/supabase-keys.mjs";
import { cachedProviderValue, fetchHardcoverUpstream, createCacheAdmin, requireReader } from '../_shared/provider-cache.ts';
import {
  applyCanonicalDiscoveryCovers,
} from "../_shared/discovery-canonical-covers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MS =
  6 * 60 * 60 * 1000;

type CacheRow = {
  payload: Record<string, unknown>;
  refreshed_at: string;
};

function jsonResponse(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

function cacheAgeMs(
  row: CacheRow | null
) {
  if (!row?.refreshed_at) {
    return Number.POSITIVE_INFINITY;
  }

  const refreshedAt =
    new Date(
      row.refreshed_at
    ).getTime();

  if (
    Number.isNaN(
      refreshedAt
    )
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return Date.now() - refreshedAt;
}

async function readCache(
  cacheKey: string
): Promise<CacheRow | null> {
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  let serviceRoleKey =
    getServerKey(name => Deno.env.get(name)) ?? null;


  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error("Discover cache is not configured.");
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/novori_discover_cache?cache_key=eq.${encodeURIComponent(
      cacheKey
    )}&select=payload,refreshed_at&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization:
          `Bearer ${serviceRoleKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Discover cache read failed (" + response.status + ").");
  }

  const rows =
    await response.json();

  return rows?.[0] ?? null;
}

async function writeCache(
  cacheKey: string,
  payload: Record<string, unknown>
) {
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  let serviceRoleKey =
    getServerKey(name => Deno.env.get(name)) ?? null;


  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    return;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/novori_discover_cache?on_conflict=cache_key`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization:
          `Bearer ${serviceRoleKey}`,
        "Content-Type":
          "application/json",
        Prefer:
          "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        cache_key: cacheKey,
        payload,
        refreshed_at:
          new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) {
    console.error(
      "Discover cache write failed:",
      response.status,
      await response.text()
    );
  }
}

function withCacheMeta(
  payload: Record<string, unknown>,
  status: string,
  refreshedAt: string,
  ttlMs: number
) {
  return {
    ...payload,
    cache: {
      status,
      refreshedAt,
      ttlSeconds:
        Math.round(
          ttlMs / 1000
        ),
    },
  };
}


function parseCachedTags(
  value: unknown
) {
  if (!value) {
    return null;
  }

  if (
    typeof value === "string"
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value as
    Record<string, unknown>;
}

function extractGenres(
  cachedTagsValue: unknown
) {
  const cachedTags =
    parseCachedTags(
      cachedTagsValue
    );

  if (
    !cachedTags ||
    typeof cachedTags !== "object"
  ) {
    return [];
  }

  const tagObject =
    cachedTags as
      Record<string, unknown>;

  const directGenreGroups = [
    tagObject.Genre,
    tagObject.genre,
    tagObject.Genres,
    tagObject.genres,
  ].filter(Array.isArray) as unknown[][];

  let genreEntries: unknown[] =
    directGenreGroups.flat();

  if (
    genreEntries.length === 0
  ) {
    genreEntries =
      Object.values(tagObject)
        .filter(Array.isArray)
        .flat()
        .filter((entry: any) => {
          const category =
            String(
              entry?.category ?? ""
            ).toLowerCase();

          const categorySlug =
            String(
              entry?.categorySlug ?? ""
            ).toLowerCase();

          return (
            category === "genre" ||
            categorySlug === "genre"
          );
        });
  }

  const genreNames =
    genreEntries
      .map((entry: any) =>
        typeof entry === "string"
          ? entry
          : entry?.tag ??
            entry?.name
      )
      .filter(Boolean)
      .map(
        (genre: string) =>
          genre.trim()
      )
      .filter(Boolean);

  return normalizeBookGenres(genreNames);
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      }
    );
  }

  let cachedRow:
    CacheRow | null = null;

  try {
    const supabaseAdmin = createCacheAdmin();
    await requireReader(supabaseAdmin, req);
    const fetchHardcover = (url: string, init: RequestInit) => fetchHardcoverUpstream(
      supabaseAdmin, url, init, 'hardcover_trending'
    );
    const token =
      Deno.env.get(
        "HARDCOVER_API_TOKEN"
      );

    if (!token) {
      return jsonResponse(
        {
          error:
            "HARDCOVER_API_TOKEN is missing",
        },
        500
      );
    }

    let days = 90;
    let poolSize = 100;
if (
      req.method === "POST"
    ) {
      try {
        const body =
          await req.json();

        if (
          typeof body?.days ===
            "number" &&
          Number.isFinite(
            body.days
          )
        ) {
          days = Math.min(
            Math.max(
              Math.round(
                body.days
              ),
              1
            ),
            365
          );
        }

        if (
          typeof body?.poolSize ===
            "number" &&
          Number.isFinite(
            body.poolSize
          )
        ) {
          poolSize = Math.min(
            Math.max(
              Math.round(
                body.poolSize
              ),
              25
            ),
            100
          );
        }

} catch {
        // Defaults are fine.
      }
    }

    const cacheKey =
      `hardcover-trending:v7:${days}:${poolSize}`;

    cachedRow =
      await readCache(
        cacheKey
      );

    const cachedAge =
      cacheAgeMs(
        cachedRow
      );

    const cacheIsFresh =
      cachedAge <
      CACHE_TTL_MS;


    if (
      cachedRow &&
      (cacheIsFresh)
    ) {
      const responsePayload =
        await applyCanonicalDiscoveryCovers(
          cachedRow.payload
        );

      return jsonResponse(
        withCacheMeta(
          responsePayload,
          "hit",
          cachedRow.refreshed_at,
          CACHE_TTL_MS
        )
      );
    }

    const refreshedPayload = await cachedProviderValue({
      admin: supabaseAdmin, provider: 'hardcover_popularity', key: 'discover:' + cacheKey,
      freshMs: CACHE_TTL_MS, staleMs: 3 * 86400000, leaseSeconds: 60,
      load: async () => {
    const today =
      new Date();

    const fromDate =
      new Date(
        today.getTime() -
          days *
            24 *
            60 *
            60 *
            1000
      );

    function toDateOnly(
      date: Date
    ) {
      return date
        .toISOString()
        .slice(0, 10);
    }

    const trendingQuery = `
      query GetTrendingBooks(
        $from: date!
        $to: date!
      ) {
        page0: books_trending(
          from: $from
          to: $to
          limit: 25
          offset: 0
        ) {
          error
          ids
        }

        page1: books_trending(
          from: $from
          to: $to
          limit: 25
          offset: 25
        ) {
          error
          ids
        }

        page2: books_trending(
          from: $from
          to: $to
          limit: 25
          offset: 50
        ) {
          error
          ids
        }

        page3: books_trending(
          from: $from
          to: $to
          limit: 25
          offset: 75
        ) {
          error
          ids
        }
      }
    `;

    const trendingResponse =
      await fetchHardcover("https://api.hardcover.app/v1/graphql",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            query:
              trendingQuery,
            variables: {
              from:
                toDateOnly(
                  fromDate
                ),
              to:
                toDateOnly(
                  today
                ),
            },
          }),
        }
      );

    const trendingJson =
      await trendingResponse.json();

    if (
      !trendingResponse.ok
    ) {
      throw new Error(
        `Hardcover trending lookup failed (${trendingResponse.status}): ${JSON.stringify(
          trendingJson
        )}`
      );
    }

    if (
      trendingJson.errors?.length
    ) {
      throw new Error(
        `Hardcover trending GraphQL errors: ${JSON.stringify(
          trendingJson.errors
        )}`
      );
    }

    const pages = [
      trendingJson?.data?.page0,
      trendingJson?.data?.page1,
      trendingJson?.data?.page2,
      trendingJson?.data?.page3,
    ];

    const pageError =
      pages.find(
        (page: any) =>
          page?.error
      )?.error;

    if (pageError) {
      throw new Error(
        String(pageError)
      );
    }

    const ids: number[] = [];
    const seenIds =
      new Set<number>();

    for (
      const page of pages
    ) {
      const pageIds =
        Array.isArray(
          page?.ids
        )
          ? page.ids
          : [];

      for (
        const id of pageIds
      ) {
        if (
          typeof id !==
            "number" ||
          !Number.isFinite(id) ||
          seenIds.has(id)
        ) {
          continue;
        }

        seenIds.add(id);
        ids.push(id);

        if (
          ids.length >=
          poolSize
        ) {
          break;
        }
      }

      if (
        ids.length >=
        poolSize
      ) {
        break;
      }
    }

    if (
      ids.length === 0
    ) {
      const emptyPayload = {
        books: [],
        windowDays: days,
        source: "Hardcover",
      };

      await writeCache(
        cacheKey,
        emptyPayload
      );

      return emptyPayload;
    }

    const booksQuery = `
      query GetBooksByIds(
        $ids: [Int!]
      ) {
        books(
          where: {
            id: { _in: $ids }
          }
        ) {
          id
          title
          slug
          release_date
          release_year
          rating
          users_count
          reviews_count
          cached_tags

          image {
            url
          }

          contributions {
            contribution

            author {
              name
              slug
            }
          }

          default_cover_edition {
            id title isbn_10 isbn_13 release_date compilation audio_seconds reading_format_id physical_format
            language { code2 code3 language }
            image { url width height }
            reading_format { format }
          }
          default_physical_edition {
            id title release_date compilation audio_seconds reading_format_id physical_format
            language { code2 code3 language }
            reading_format { format }
          }
          default_ebook_edition {
            id title release_date compilation audio_seconds reading_format_id physical_format
            language { code2 code3 language }
            reading_format { format }
          }
          editions(
            limit: 100
            where: { language: { code2: { _eq: "en" } } }
            order_by: [{ release_date: asc_nulls_last }, { id: asc }]
          ) {
            id title isbn_10 isbn_13 release_date compilation audio_seconds reading_format_id physical_format
            language { code2 code3 language }
            image { url width height }
            reading_format { format }
          }
        }
      }
    `;

    const booksResponse =
      await fetchHardcover("https://api.hardcover.app/v1/graphql",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: booksQuery,
            variables: { ids },
          }),
        }
      );

    const booksJson =
      await booksResponse.json();

    if (
      !booksResponse.ok
    ) {
      throw new Error(
        `Hardcover book details lookup failed (${booksResponse.status}): ${JSON.stringify(
          booksJson
        )}`
      );
    }

    if (
      booksJson.errors?.length
    ) {
      throw new Error(
        `Hardcover book details GraphQL errors: ${JSON.stringify(
          booksJson.errors
        )}`
      );
    }

    const rawBooks =
      booksJson?.data?.books ??
      [];

    const booksById =
      new Map(
        rawBooks.map(
          (book: any) => [
            book.id,
            book,
          ]
        )
      );

    const books =
      ids
        .map(
          (id) =>
            booksById.get(id)
        )
        .filter(Boolean)
        .filter(hardcoverDiscoveryEligible)
        .map(
          (
            book: any,
            index: number
          ) => {
            const authors =
              (
                book?.contributions ??
                []
              )
                .filter(
                  (
                    contribution: any
                  ) => {
                    const role =
                      String(
                        contribution
                          ?.contribution ??
                        ""
                      )
                        .trim()
                        .toLowerCase();

                    return (
                      !role ||
                      role ===
                        "author"
                    );
                  }
                )
                .map(
                  (
                    contribution: any
                  ) =>
                    contribution
                      ?.author
                      ?.name
                )
                .filter(Boolean);

            const isbns = englishEditionIsbns(book?.editions);

            return {
              rank:
                index + 1,
              id: book.id,
              title:
                book.title ??
                "Untitled",
              slug:
                book.slug ??
                null,
              releaseDate:
                book.release_date ??
                null,
              releaseYear:
                book.release_year ??
                null,
              rating:
                book.rating ??
                null,
              usersCount:
                book.users_count ??
                null,
              coverUrl: verifiedEnglishSeriesArt(book, true)?.url ?? null,
              coverEdition: verifiedEnglishSeriesArt(book, true),
              reviewsCount: book.reviews_count ?? null,
              formatPolicyVersion: 1,
              authors,
              isbns:
                Array.from(
                  new Set(isbns)
                ),
              genres:
                extractGenres(
                  book.cached_tags
                ),
            };
          }
        );

    const payload = {
      books,
      windowDays: days,
      source: "Hardcover",
    };

    await writeCache(
      cacheKey,
      payload
    );

    return payload;
      },
    });
    const responsePayload = await applyCanonicalDiscoveryCovers(refreshedPayload);
    return jsonResponse(withCacheMeta(responsePayload, "shared", new Date().toISOString(), CACHE_TTL_MS));
  } catch (error) {
    console.error(
      "hardcover-trending error:",
      error
    );

    if (cachedRow && cacheAgeMs(cachedRow) < 3 * 86400000) {
      const responsePayload =
        await applyCanonicalDiscoveryCovers(
          cachedRow.payload
        );

      return jsonResponse(
        withCacheMeta(
          responsePayload,
          "stale-fallback",
          cachedRow.refreshed_at,
          CACHE_TTL_MS
        )
      );
    }

    return jsonResponse(
      {
        error:
          "Unexpected error",
        details:
          String(error),
      },
      500
    );
  }
});
