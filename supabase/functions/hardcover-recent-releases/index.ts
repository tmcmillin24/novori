import { providerTrace, noteProviderCache } from '../_shared/provider-observability.ts';
import { hardcoverDiscoveryEligible } from '../_shared/hardcover-discovery-policy.ts';
import { normalizeBookGenres } from '../_shared/book-genres.ts';
import { hardcoverDiscoveryArt } from '../_shared/hardcover-discovery-covers.ts';
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
  2 * 60 * 60 * 1000;

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
  ttlMs: number, cacheTrace?: unknown
) {
  return {
    ...payload,
    cacheTrace,
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

  let requestTrace: ReturnType<typeof providerTrace> | undefined;
  try {
    const supabaseAdmin = createCacheAdmin();
    requestTrace = providerTrace(supabaseAdmin);
    await requireReader(supabaseAdmin, req);
    const fetchHardcover = (url: string, init: RequestInit) => fetchHardcoverUpstream(
      supabaseAdmin, url, init, 'hardcover_recent_releases'
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

    let months = 18;
    let poolSize = 150;
if (
      req.method === "POST"
    ) {
      try {
        const body =
          await req.json();

        if (
          typeof body?.months ===
            "number" &&
          Number.isFinite(
            body.months
          )
        ) {
          months = Math.min(
            Math.max(
              Math.round(
                body.months
              ),
              1
            ),
            24
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
              50
            ),
            200
          );
        }

} catch {
        // Defaults are fine.
      }
    }

    const cacheKey =
      `hardcover-recent-releases:v5:${months}:${poolSize}`;

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
      noteProviderCache(supabaseAdmin,'hardcover_popularity','hit-discovery',cacheKey);
      const responsePayload =
        await applyCanonicalDiscoveryCovers(
          cachedRow.payload
        );

      return jsonResponse(
        withCacheMeta(
          responsePayload,
          "hit",
          cachedRow.refreshed_at,
          CACHE_TTL_MS, requestTrace
        )
      );
    }

    let sharedRefreshedAt = new Date().toISOString();
    const refreshedPayload = await cachedProviderValue({
      admin: supabaseAdmin, provider: 'hardcover_popularity', key: 'discover:' + cacheKey,
      freshMs: CACHE_TTL_MS, staleMs: 3 * 86400000, leaseSeconds: 60,
      onCacheRead: row => { sharedRefreshedAt = row.fetched_at; },
      load: async () => {
    const today =
      new Date();

    const fromDate =
      new Date(today);

    fromDate.setMonth(
      fromDate.getMonth() -
        months
    );

    function toDateOnly(
      date: Date
    ) {
      return date
        .toISOString()
        .slice(0, 10);
    }

    const releasesQuery = `
      query GetRecentReleases(
        $from: date!
        $to: date!
        $limit: Int!
      ) {
        books(
          where: {
            release_date: {
              _gte: $from
              _lte: $to
            }
          }
          order_by: [
            { release_date: desc }
            { users_count: desc }
          ]
          limit: $limit
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
            query:
              releasesQuery,
            variables: {
              from:
                toDateOnly(
                  fromDate
                ),
              to:
                toDateOnly(
                  today
                ),
              limit:
                poolSize,
            },
          }),
        }
      );

    const booksJson =
      await booksResponse.json();

    if (
      !booksResponse.ok
    ) {
      throw new Error(
        `Hardcover recent releases lookup failed (${booksResponse.status}): ${JSON.stringify(
          booksJson
        )}`
      );
    }

    if (
      booksJson.errors?.length
    ) {
      throw new Error(
        `Hardcover recent releases GraphQL errors: ${JSON.stringify(
          booksJson.errors
        )}`
      );
    }

    const rawBooks =
      booksJson?.data?.books ??
      [];

    const books =
      rawBooks.filter(hardcoverDiscoveryEligible).map(
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
            coverUrl: hardcoverDiscoveryArt(book)?.url ?? null,
              coverProof: hardcoverDiscoveryArt(book),
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
      windowMonths:
        months,
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
    return jsonResponse(withCacheMeta(responsePayload, "shared", sharedRefreshedAt, CACHE_TTL_MS, requestTrace));
  } catch (error) {
    console.error(
      "hardcover-recent-releases error:",
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
          CACHE_TTL_MS, requestTrace
        )
      );
    }

    return jsonResponse(
      {
        error:
          "Unexpected error",
        cacheTrace:requestTrace,
        details:
          String(error),
      },
      500
    );
  }
});
