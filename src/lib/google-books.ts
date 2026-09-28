type CachedGoogleResponse = {
  expiresAt: number;
  response: Response;
};

const GOOGLE_BOOKS_CACHE_MS =
  5 * 60 * 1000;

const googleBooksResponseCache =
  new Map<string, CachedGoogleResponse>();

const googleBooksInFlight =
  new Map<string, Promise<Response>>();

function wait(
  milliseconds: number
) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

function getRetryDelay(
  response: Response
) {
  const retryAfter =
    response.headers.get(
      'retry-after'
    );

  if (retryAfter) {
    const seconds =
      Number(
        retryAfter
      );

    if (
      Number.isFinite(
        seconds
      ) &&
      seconds >
        0
    ) {
      return Math.min(
        seconds *
          1000,
        5000
      );
    }
  }

  return 1000;
}

async function performGoogleBooksFetch(
  url: string,
  init?: RequestInit
) {
  let response =
    await fetch(
      url,
      init
    );

  if (
    response.status ===
    429
  ) {
    await wait(
      getRetryDelay(
        response
      )
    );

    response =
      await fetch(
        url,
        init
      );
  }

  return response;
}

export async function googleBooksFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const method =
    init?.method ??
    'GET';

  if (
    method !==
    'GET'
  ) {
    return performGoogleBooksFetch(
      url,
      init
    );
  }

  const cached =
    googleBooksResponseCache.get(
      url
    );

  if (
    cached &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached.response.clone();
  }

  const existing =
    googleBooksInFlight.get(
      url
    );

  if (existing) {
    const response =
      await existing;

    return response.clone();
  }

  const request =
    performGoogleBooksFetch(
      url,
      init
    );

  googleBooksInFlight.set(
    url,
    request
  );

  try {
    const response =
      await request;

    if (response.ok) {
      googleBooksResponseCache.set(
        url,
        {
          expiresAt:
            Date.now() +
            GOOGLE_BOOKS_CACHE_MS,
          response:
            response.clone(),
        }
      );
    }

    return response;
  } finally {
    googleBooksInFlight.delete(
      url
    );
  }
}
