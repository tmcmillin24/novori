const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type InputBook = {
  googleBookId: string;
  isbns: string[];
};

type HardcoverBook = {
  id: number;
  title: string;
  rating: number | string | null;
  ratings_count: number;
  reviews_count: number;
  users_count: number;
  editions: {
    isbn_10: string | null;
    isbn_13: string | null;
  }[];
};

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
      const token =
        Deno.env.get(
          'HARDCOVER_API_TOKEN'
        ) ??
        Deno.env.get(
          'HARDCOVER_API_KEY'
        ) ??
        Deno.env.get(
          'HARDCOVER_TOKEN'
        );

      if (
        !token
      ) {
        throw new Error(
          'Hardcover API token is not configured.'
        );
      }

      const body =
        await request.json();

      const books =
        Array.isArray(
          body?.books
        )
          ? (
              body.books as
                InputBook[]
            )
          : [];

      const normalizedBooks =
        books
          .map(
            (
              book
            ) => ({
              googleBookId:
                String(
                  book.googleBookId ??
                    ''
                ),
              isbns:
                Array.from(
                  new Set(
                    (
                      book.isbns ??
                      []
                    )
                      .map(
                        normalizeIsbn
                      )
                      .filter(
                        Boolean
                      )
                  )
                ),
            })
          )
          .filter(
            (
              book
            ) =>
              book.googleBookId &&
              book.isbns.length >
                0
          )
          .slice(
            0,
            40
          );

      if (
        normalizedBooks.length ===
        0
      ) {
        return new Response(
          JSON.stringify({
            popularity: {},
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

      const allIsbns =
        Array.from(
          new Set(
            normalizedBooks.flatMap(
              (
                book
              ) =>
                book.isbns
            )
          )
        );

      const query = `
        query HardcoverPopularity(
          $isbns: [String!]!
        ) {
          books(
            where: {
              editions: {
                _or: [
                  {
                    isbn_10: {
                      _in: $isbns
                    }
                  },
                  {
                    isbn_13: {
                      _in: $isbns
                    }
                  }
                ]
              }
            }
          ) {
            id
            title
            rating
            ratings_count
            reviews_count
            users_count
            editions {
              isbn_10
              isbn_13
            }
          }
        }
      `;

      const response =
        await fetch(
          'https://api.hardcover.app/v1/graphql',
          {
            method:
              'POST',
            headers: {
              Authorization:
                `Bearer ${token}`,
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                query,
                variables: {
                  isbns:
                    allIsbns,
                },
              }),
          }
        );

      if (
        !response.ok
      ) {
        const details =
          await response.text();

        throw new Error(
          `Hardcover API request failed (${response.status}): ${details}`
        );
      }

      const payload =
        await response.json();

      if (
        Array.isArray(
          payload?.errors
        ) &&
        payload.errors
          .length >
          0
      ) {
        throw new Error(
          payload.errors
            .map(
              (
                error:
                  {
                    message?: string;
                  }
              ) =>
                error.message ??
                'Unknown Hardcover error'
            )
            .join(
              '; '
            )
        );
      }

      const hardcoverBooks:
        HardcoverBook[] =
        Array.isArray(
          payload?.data?.books
        )
          ? payload.data.books
          : [];

      const popularity:
        Record<
          string,
          {
            usersCount: number;
            rating:
              number | null;
            ratingsCount: number;
            reviewsCount: number;
          }
        > = {};

      for (
        const inputBook of
        normalizedBooks
      ) {
        const wantedIsbns =
          new Set(
            inputBook.isbns
          );

        const matches =
          hardcoverBooks
            .filter(
              (
                book
              ) =>
                (
                  book.editions ??
                  []
                ).some(
                  (
                    edition
                  ) => {
                    const isbn10 =
                      normalizeIsbn(
                        edition.isbn_10
                      );

                    const isbn13 =
                      normalizeIsbn(
                        edition.isbn_13
                      );

                    return (
                      (
                        isbn10 &&
                        wantedIsbns.has(
                          isbn10
                        )
                      ) ||
                      (
                        isbn13 &&
                        wantedIsbns.has(
                          isbn13
                        )
                      )
                    );
                  }
                )
            )
            .sort(
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
                  )
            );

        const best =
          matches[0];

        if (
          !best
        ) {
          continue;
        }

        const rating =
          best.rating ===
            null ||
          best.rating ===
            undefined
            ? null
            : Number(
                best.rating
              );

        popularity[
          inputBook.googleBookId
        ] = {
          usersCount:
            Number(
              best.users_count ??
                0
            ),
          rating:
            rating !==
              null &&
            Number.isFinite(
              rating
            )
              ? rating
              : null,
          ratingsCount:
            Number(
              best.ratings_count ??
                0
            ),
          reviewsCount:
            Number(
              best.reviews_count ??
                0
            ),
        };
      }

      return new Response(
        JSON.stringify({
          popularity,
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
        'hardcover-search-popularity failed:',
        error
      );

      return new Response(
        JSON.stringify({
          error:
            error instanceof
            Error
              ? error.message
              : 'Could not load Hardcover popularity.',
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
