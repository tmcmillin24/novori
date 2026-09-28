const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type CacheRow = {
  cache_key: string;
  payload: unknown;
  expires_at: string;
};

function normalizeGoogleBooksUrl(
  rawUrl: string
) {
  const url =
    new URL(
      rawUrl
    );

  if (
    url.protocol !==
      'https:' ||
    url.hostname !==
      'www.googleapis.com' ||
    !url.pathname.startsWith(
      '/books/v1/volumes'
    )
  ) {
    throw new Error(
      'Unsupported Google Books request.'
    );
  }

  url.searchParams.delete(
    'key'
  );

  const sorted =
    Array.from(
      url.searchParams.entries()
    ).sort(
      (
        a,
        b
      ) =>
        a[0].localeCompare(
          b[0]
        ) ||
        a[1].localeCompare(
          b[1]
        )
    );

  url.search =
    '';

  for (
    const [
      key,
      value,
    ] of sorted
  ) {
    url.searchParams.append(
      key,
      value
    );
  }

  return url;
}

function getTtlMs(
  url: URL
) {
  const isExactVolume =
    /^\/books\/v1\/volumes\/[^/]+$/.test(
      url.pathname
    );

  if (
    isExactVolume
  ) {
    return (
      30 *
      24 *
      60 *
      60 *
      1000
    );
  }

  const query =
    url.searchParams.get(
      'q'
    ) ??
    '';

  if (
    query.startsWith(
      'isbn:'
    )
  ) {
    return (
      7 *
      24 *
      60 *
      60 *
      1000
    );
  }

  if (
    query.includes(
      'inauthor:'
    )
  ) {
    return (
      24 *
      60 *
      60 *
      1000
    );
  }

  return (
    12 *
    60 *
    60 *
    1000
  );
}

function cacheKeyForUrl(
  url: URL
) {
  return (
    url.pathname +
    (
      url.search
        ? url.search
        : ''
    )
  );
}

async function supabaseRest(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  init?: RequestInit
) {
  return fetch(
    `${supabaseUrl}/rest/v1/${path}`,
    {
      ...init,
      headers: {
        apikey:
          serviceRoleKey,
        Authorization:
          `Bearer ${serviceRoleKey}`,
        'Content-Type':
          'application/json',
        ...(
          init?.headers ??
          {}
        ),
      },
    }
  );
}

async function readRequestCache(
  supabaseUrl: string,
  serviceRoleKey: string,
  cacheKey: string
) {
  const params =
    new URLSearchParams({
      select:
        'cache_key,payload,expires_at',
      cache_key:
        `eq.${cacheKey}`,
      expires_at:
        `gt.${new Date().toISOString()}`,
      limit:
        '1',
    });

  const response =
    await supabaseRest(
      supabaseUrl,
      serviceRoleKey,
      `google_books_request_cache?${params.toString()}`
    );

  if (
    !response.ok
  ) {
    return null;
  }

  const rows =
    await response.json() as
      CacheRow[];

  return rows[0] ??
    null;
}

async function readBookCache(
  supabaseUrl: string,
  serviceRoleKey: string,
  googleBookId: string
) {
  const params =
    new URLSearchParams({
      select:
        'google_book_id,metadata,fetched_at',
      google_book_id:
        `eq.${googleBookId}`,
      fetched_at:
        `gt.${new Date(
          Date.now() -
          30 *
            24 *
            60 *
            60 *
            1000
        ).toISOString()}`,
      limit:
        '1',
    });

  const response =
    await supabaseRest(
      supabaseUrl,
      serviceRoleKey,
      `google_books_catalog?${params.toString()}`
    );

  if (
    !response.ok
  ) {
    return null;
  }

  const rows =
    await response.json() as {
      google_book_id: string;
      metadata: unknown;
      fetched_at: string;
    }[];

  return rows[0]
    ?.metadata ??
    null;
}

async function writeRequestCache(
  supabaseUrl: string,
  serviceRoleKey: string,
  cacheKey: string,
  payload: unknown,
  expiresAt: string
) {
  const response =
    await supabaseRest(
      supabaseUrl,
      serviceRoleKey,
      'google_books_request_cache?on_conflict=cache_key',
      {
        method:
          'POST',
        headers: {
          Prefer:
            'resolution=merge-duplicates,return=minimal',
        },
        body:
          JSON.stringify([
            {
              cache_key:
                cacheKey,
              payload,
              expires_at:
                expiresAt,
              fetched_at:
                new Date().toISOString(),
            },
          ]),
      }
    );

  if (
    !response.ok
  ) {
    console.warn(
      'Could not persist Google Books request cache:',
      await response.text()
    );
  }
}

async function writeBooks(
  supabaseUrl: string,
  serviceRoleKey: string,
  books: unknown[]
) {
  const rows =
    books
      .filter(
        (
          book
        ): book is {
          id: string;
          [key: string]:
            unknown;
        } =>
          Boolean(
            book &&
            typeof book ===
              'object' &&
            typeof (
              book as {
                id?: unknown;
              }
            ).id ===
              'string'
          )
      )
      .map(
        (
          book
        ) => ({
          google_book_id:
            book.id,
          metadata:
            book,
          fetched_at:
            new Date().toISOString(),
        })
      );

  if (
    rows.length ===
    0
  ) {
    return;
  }

  const response =
    await supabaseRest(
      supabaseUrl,
      serviceRoleKey,
      'google_books_catalog?on_conflict=google_book_id',
      {
        method:
          'POST',
        headers: {
          Prefer:
            'resolution=merge-duplicates,return=minimal',
        },
        body:
          JSON.stringify(
            rows
          ),
      }
    );

  if (
    !response.ok
  ) {
    console.warn(
      'Could not persist Google Books catalog rows:',
      await response.text()
    );
  }
}

Deno.serve(
  async (
    request
  ) => {
    if (
      request.method ===
      'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers:
            corsHeaders,
        }
      );
    }

    try {
      const googleApiKey =
        Deno.env.get(
          'GOOGLE_BOOKS_API_KEY'
        );

      const supabaseUrl =
        Deno.env.get(
          'SUPABASE_URL'
        );

      const serviceRoleKey =
        Deno.env.get(
          'SUPABASE_SERVICE_ROLE_KEY'
        );

      if (
        !googleApiKey ||
        !supabaseUrl ||
        !serviceRoleKey
      ) {
        throw new Error(
          'Google Books proxy secrets are not configured.'
        );
      }

      const body =
        await request.json();

      const rawUrl =
        typeof body?.url ===
          'string'
          ? body.url
          : '';

      if (
        !rawUrl
      ) {
        return new Response(
          JSON.stringify({
            error:
              'A Google Books URL is required.',
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type':
                'application/json',
            },
          }
        );
      }

      const normalizedUrl =
        normalizeGoogleBooksUrl(
          rawUrl
        );

      const cacheKey =
        cacheKeyForUrl(
          normalizedUrl
        );

      const exactVolumeMatch =
        normalizedUrl.pathname.match(
          /^\/books\/v1\/volumes\/([^/]+)$/
        );

      if (
        exactVolumeMatch?.[1]
      ) {
        const cachedBook =
          await readBookCache(
            supabaseUrl,
            serviceRoleKey,
            decodeURIComponent(
              exactVolumeMatch[1]
            )
          );

        if (
          cachedBook
        ) {
          return new Response(
            JSON.stringify({
              status: 200,
              data:
                cachedBook,
              source:
                'book-cache',
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type':
                  'application/json',
              },
            }
          );
        }
      }

      const cachedRequest =
        await readRequestCache(
          supabaseUrl,
          serviceRoleKey,
          cacheKey
        );

      if (
        cachedRequest
      ) {
        return new Response(
          JSON.stringify({
            status: 200,
            data:
              cachedRequest.payload,
            source:
              'request-cache',
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type':
                'application/json',
            },
          }
        );
      }

      normalizedUrl.searchParams.set(
        'key',
        googleApiKey
      );

      const googleResponse =
        await fetch(
          normalizedUrl.toString()
        );

      let payload:
        unknown =
        null;

      try {
        payload =
          await googleResponse.json();
      } catch {
        payload =
          null;
      }

      if (
        !googleResponse.ok
      ) {
        return new Response(
          JSON.stringify({
            status:
              googleResponse.status,
            data:
              payload,
            source:
              'google',
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type':
                'application/json',
            },
          }
        );
      }

      const ttlMs =
        getTtlMs(
          normalizedUrl
        );

      const expiresAt =
        new Date(
          Date.now() +
          ttlMs
        ).toISOString();

      await writeRequestCache(
        supabaseUrl,
        serviceRoleKey,
        cacheKey,
        payload,
        expiresAt
      );

      const books =
        Array.isArray(
          (
            payload as {
              items?: unknown[];
            }
          )?.items
        )
          ? (
              payload as {
                items: unknown[];
              }
            ).items
          : exactVolumeMatch &&
            payload &&
            typeof payload ===
              'object'
          ? [
              payload,
            ]
          : [];

      await writeBooks(
        supabaseUrl,
        serviceRoleKey,
        books
      );

      return new Response(
        JSON.stringify({
          status: 200,
          data:
            payload,
          source:
            'google',
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        }
      );
    } catch (
      error
    ) {
      console.error(
        'Google Books proxy error:',
        error
      );

      return new Response(
        JSON.stringify({
          error:
            error instanceof
            Error
              ? error.message
              : 'Unknown Google Books proxy error.',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        }
      );
    }
  }
);
