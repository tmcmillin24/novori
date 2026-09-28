type CachedGoogleResponse = {
  expiresAt: number;
  response: Response;
};

const GOOGLE_BOOKS_CACHE_MS =
  5 * 60 * 1000;

const GOOGLE_BOOKS_MAX_RETRIES =
  4;

const GOOGLE_BOOKS_MAX_BACKOFF_MS =
  8000;

const GOOGLE_BOOKS_MIN_REQUEST_GAP_MS =
  175;

const googleBooksResponseCache =
  new Map<string, CachedGoogleResponse>();

const googleBooksInFlight =
  new Map<string, Promise<Response>>();

let googleBooksNextAllowedAt =
  0;

let googleBooksQueue:
  Promise<void> =
  Promise.resolve();

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
  response: Response,
  attempt: number
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
        GOOGLE_BOOKS_MAX_BACKOFF_MS
      );
    }
  }

  const exponentialDelay =
    Math.min(
      1000 *
        2 **
          attempt,
      GOOGLE_BOOKS_MAX_BACKOFF_MS
    );

  const jitter =
    Math.floor(
      Math.random() *
        500
    );

  return (
    exponentialDelay +
    jitter
  );
}

async function waitForGoogleBooksWindow() {
  const delay =
    googleBooksNextAllowedAt -
    Date.now();

  if (
    delay >
    0
  ) {
    await wait(
      delay
    );
  }
}

async function performGoogleBooksFetch(
  url: string,
  init?: RequestInit
) {
  for (
    let attempt = 0;
    attempt <=
    GOOGLE_BOOKS_MAX_RETRIES;
    attempt += 1
  ) {
    await waitForGoogleBooksWindow();

    const response =
      await fetch(
        url,
        init
      );

    googleBooksNextAllowedAt =
      Math.max(
        googleBooksNextAllowedAt,
        Date.now() +
          GOOGLE_BOOKS_MIN_REQUEST_GAP_MS
      );

    if (
      response.status !==
      429
    ) {
      return response;
    }

    if (
      attempt ===
      GOOGLE_BOOKS_MAX_RETRIES
    ) {
      return response;
    }

    const retryDelay =
      getRetryDelay(
        response,
        attempt
      );

    googleBooksNextAllowedAt =
      Math.max(
        googleBooksNextAllowedAt,
        Date.now() +
          retryDelay
      );
  }

  return fetch(
    url,
    init
  );
}

async function enqueueGoogleBooksFetch(
  url: string,
  init?: RequestInit
) {
  let resolveQueued:
    (
      response: Response
    ) => void;
  let rejectQueued:
    (
      error: unknown
    ) => void;

  const result =
    new Promise<Response>(
      (
        resolve,
        reject
      ) => {
        resolveQueued =
          resolve;
        rejectQueued =
          reject;
      }
    );

  googleBooksQueue =
    googleBooksQueue
      .catch(
        () => undefined
      )
      .then(
        async () => {
          try {
            const response =
              await performGoogleBooksFetch(
                url,
                init
              );

            resolveQueued(
              response
            );
          } catch (
            error
          ) {
            rejectQueued(
              error
            );
          }
        }
      );

  return result;
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
    return enqueueGoogleBooksFetch(
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
    enqueueGoogleBooksFetch(
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
