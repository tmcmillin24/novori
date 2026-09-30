const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MS =
  6 * 60 * 60 * 1000;

const FORCE_REFRESH_COOLDOWN_MS =
  10 * 60 * 1000;

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
  const secretKeysJson =
    Deno.env.get(
      "SUPABASE_SECRET_KEYS"
    );

  let serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    ) ?? null;

  if (secretKeysJson) {
    try {
      const secretKeys =
        JSON.parse(
          secretKeysJson
        );

      serviceRoleKey =
        secretKeys?.default ??
        serviceRoleKey;
    } catch {
      // Fall back to the legacy service-role key.
    }
  }

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    return null;
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
    console.error(
      "Discover cache read failed:",
      response.status,
      await response.text()
    );
    return null;
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
  const secretKeysJson =
    Deno.env.get(
      "SUPABASE_SECRET_KEYS"
    );

  let serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    ) ?? null;

  if (secretKeysJson) {
    try {
      const secretKeys =
        JSON.parse(
          secretKeysJson
        );

      serviceRoleKey =
        secretKeys?.default ??
        serviceRoleKey;
    } catch {
      // Fall back to the legacy service-role key.
    }
  }

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

  return Array.from(
    new Set(genreNames)
  );
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
    let forceRefresh = false;

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

        forceRefresh =
          body?.forceRefresh ===
          true;
      } catch {
        // Defaults are fine.
      }
    }

    const cacheKey =
      `hardcover-trending:v5:${days}:${poolSize}`;

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

    const forceRefreshIsCoolingDown =
      forceRefresh &&
      cachedAge <
        FORCE_REFRESH_COOLDOWN_MS;

    if (
      cachedRow &&
      (
        (!forceRefresh &&
          cacheIsFresh) ||
        forceRefreshIsCoolingDown
      )
    ) {
      return jsonResponse(
        withCacheMeta(
          cachedRow.payload,
          forceRefreshIsCoolingDown
            ? "manual-cooldown-hit"
            : "hit",
          cachedRow.refreshed_at,
          CACHE_TTL_MS
        )
      );
    }

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
      await fetch(
        "https://api.hardcover.app/v1/graphql",
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

      return jsonResponse(
        withCacheMeta(
          emptyPayload,
          "refreshed",
          new Date().toISOString(),
          CACHE_TTL_MS
        )
      );
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

          editions(
            limit: 10
            order_by: {
              users_count: desc
            }
          ) {
            isbn_10
            isbn_13
          }
        }
      }
    `;

    const booksResponse =
      await fetch(
        "https://api.hardcover.app/v1/graphql",
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

            const isbns =
              (
                book?.editions ??
                []
              )
                .flatMap(
                  (
                    edition: any
                  ) => [
                    edition?.isbn_13,
                    edition?.isbn_10,
                  ]
                )
                .filter(Boolean);

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
              coverUrl:
                book.image?.url ??
                null,
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

    return jsonResponse(
      withCacheMeta(
        payload,
        "refreshed",
        new Date().toISOString(),
        CACHE_TTL_MS
      )
    );
  } catch (error) {
    console.error(
      "hardcover-trending error:",
      error
    );

    if (cachedRow) {
      return jsonResponse(
        withCacheMeta(
          cachedRow.payload,
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