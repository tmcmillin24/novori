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
      !titlesMatch(
        title,
        book.title
      ) ||
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
      !titlesMatch(
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

async function hardcoverRequest(
  token: string,
  query: string,
  variables: Record<
    string,
    unknown
  >
) {
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
            variables,
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
    payload.errors.length >
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

  return payload;
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

      const allowTitleFallback =
        body?.allowTitleFallback ===
        true;

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
              title:
                String(
                  book.title ??
                    ''
                ).trim(),
              authors:
                Array.isArray(
                  book.authors
                )
                  ? book.authors
                      .filter(
                        (
                          author
                        ): author is string =>
                          typeof author ===
                          'string' &&
                          author.trim()
                            .length >
                            0
                      )
                      .map(
                        (
                          author
                        ) =>
                          author.trim()
                      )
                  : [],
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
              (
                book.isbns.length >
                  0 ||
                (
                  allowTitleFallback &&
                  book.title
                )
              )
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

      let isbnBooks:
        HardcoverBook[] =
        [];

      if (
        allIsbns.length >
        0
      ) {
        const isbnQuery = `
          query HardcoverByIsbn(
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
              ${bookFields}
              editions {
                isbn_10
                isbn_13
              }
            }
          }
        `;

        const payload =
          await hardcoverRequest(
            token,
            isbnQuery,
            {
              isbns:
                allIsbns,
            }
          );

        isbnBooks =
          Array.isArray(
            payload?.data?.books
          )
            ? payload.data.books
            : [];
      }

      const popularity:
        Record<
          string,
          {
            usersCount: number;
            rating:
              number | null;
            ratingsCount: number;
            reviewsCount: number;
            hardcoverBookId: number;
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

        const isbnMatches =
          isbnBooks.filter(
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
          );

        let best =
          chooseBestBook(
            isbnMatches,
            inputBook.title,
            inputBook.authors
          );

        if (
          !best &&
          allowTitleFallback &&
          inputBook.title
        ) {
          const canonicalTitle =
            canonicalizeTitle(
              inputBook.title
            );

          const primaryAuthor =
            inputBook.authors[0]
              ?.trim() ??
            '';

          const exactTitleQuery =
            primaryAuthor
              ? `
                query HardcoverByWork(
                  $title: String!
                  $author: String!
                ) {
                  books(
                    where: {
                      title: {
                        _ilike: $title
                      }
                      contributions: {
                        author: {
                          name: {
                            _ilike: $author
                          }
                        }
                      }
                    }
                    order_by: [
                      {
                        ratings_count: desc
                      }
                    ]
                    limit: 50
                  ) {
                    ${bookFields}
                  }
                }
              `
              : `
                query HardcoverByWork(
                  $title: String!
                ) {
                  books(
                    where: {
                      title: {
                        _ilike: $title
                      }
                    }
                    order_by: [
                      {
                        ratings_count: desc
                      }
                    ]
                    limit: 50
                  ) {
                    ${bookFields}
                  }
                }
              `;

          const exactPayload =
            await hardcoverRequest(
              token,
              exactTitleQuery,
              primaryAuthor
                ? {
                    title:
                      canonicalTitle,
                    author:
                      primaryAuthor,
                  }
                : {
                    title:
                      canonicalTitle,
                  }
            );

          const exactBooks:
            HardcoverBook[] =
            Array.isArray(
              exactPayload?.data?.books
            )
              ? exactPayload.data.books
              : [];

          best =
            chooseBestBook(
              exactBooks,
              inputBook.title,
              inputBook.authors
            );

          if (
            !best &&
            primaryAuthor
          ) {
            const fuzzyQuery = `
              query HardcoverByWorkFuzzy(
                $title: String!
                $author: String!
              ) {
                books(
                  where: {
                    title: {
                      _ilike: $title
                    }
                    contributions: {
                      author: {
                        name: {
                          _ilike: $author
                        }
                      }
                    }
                  }
                  order_by: [
                    {
                      ratings_count: desc
                    }
                  ]
                  limit: 100
                ) {
                  ${bookFields}
                }
              }
            `;

            const fuzzyPayload =
              await hardcoverRequest(
                token,
                fuzzyQuery,
                {
                  title:
                    `%${canonicalTitle}%`,
                  author:
                    primaryAuthor,
                }
              );

            const fuzzyBooks:
              HardcoverBook[] =
              Array.isArray(
                fuzzyPayload?.data?.books
              )
                ? fuzzyPayload.data.books
                : [];

            best =
              chooseBestBook(
                fuzzyBooks,
                inputBook.title,
                inputBook.authors
              );
          }
        }

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
          hardcoverBookId:
            best.id,
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
