Deno.serve(async (req) => {

  const corsHeaders = {

    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Headers":

      "authorization, x-client-info, apikey, content-type",

  };



  if (req.method === "OPTIONS") {

    return new Response("ok", {

      headers: corsHeaders,

    });

  }



  try {

    const body = await req.json();

    const requestedIsbns = Array.from(
      new Set(
        [
          body?.isbn,
          ...(Array.isArray(body?.isbns)
            ? body.isbns
            : []),
        ]
          .filter(Boolean)
          .map((value) =>
            String(value)
              .replace(/[^0-9Xx]/g, "")
              .toUpperCase()
          )
          .filter(Boolean)
      )
    );

    const requestedTitle =
      typeof body?.title === "string"
        ? body.title.trim()
        : "";

    const requestedAuthors =
      Array.isArray(body?.authors)
        ? body.authors
            .filter(
              (author) =>
                typeof author === "string" &&
                author.trim()
            )
            .map((author) =>
              author.trim()
            )
        : [];

    if (
      requestedIsbns.length === 0 &&
      !requestedTitle
    ) {

      return new Response(

        JSON.stringify({

          error:
            "At least one ISBN or a title is required",

        }),

        {

          status: 400,

          headers: {

            ...corsHeaders,

            "Content-Type": "application/json",

          },

        }

      );

    }



    const token = Deno.env.get(

      "HARDCOVER_API_TOKEN"

    );



    if (!token) {

      return new Response(

        JSON.stringify({

          error:

            "HARDCOVER_API_TOKEN is missing",

        }),

        {

          status: 500,

          headers: {

            ...corsHeaders,

            "Content-Type": "application/json",

          },

        }

      );

    }





    // Google Books is only used as a fallback when

    // Hardcover is missing language metadata. Using

    // a server-side key is recommended, but the API

    // can still be queried without one at low volume.

    const googleApiKey =

      Deno.env.get(

        "GOOGLE_BOOKS_API_KEY"

      ) ?? "";



    // Normalize common 2-letter, 3-letter, and name

    // variants so language comparisons work whether

    // the source is Hardcover or Google Books.

    const languageAliasGroups = [

      ["en", "eng", "english"],

      ["es", "spa", "spanish"],

      ["it", "ita", "italian"],

      ["fr", "fra", "fre", "french"],

      ["de", "deu", "ger", "german"],

      ["pt", "por", "portuguese"],

      ["nl", "nld", "dut", "dutch"],

      ["pl", "pol", "polish"],

      ["ru", "rus", "russian"],

      ["uk", "ukr", "ukrainian"],

      ["sv", "swe", "swedish"],

      ["da", "dan", "danish"],

      ["no", "nor", "norwegian"],

      ["fi", "fin", "finnish"],

      ["cs", "ces", "cze", "czech"],

      ["hu", "hun", "hungarian"],

      ["ro", "ron", "rum", "romanian"],

      ["tr", "tur", "turkish"],

      ["el", "ell", "gre", "greek"],

      ["bg", "bul", "bulgarian"],

      ["ja", "jpn", "japanese"],

      ["ko", "kor", "korean"],

      ["zh", "zho", "chi", "cmn", "chinese"],

    ];



    function expandLanguageKeys(

      values: Array<unknown>

    ) {

      const normalized = new Set(

        values

          .filter(Boolean)

          .map((value) =>

            String(value)

              .toLowerCase()

              .trim()

          )

          .filter(Boolean)

      );



      for (

        const group of languageAliasGroups

      ) {

        if (

          group.some((key) =>

            normalized.has(key)

          )

        ) {

          for (const key of group) {

            normalized.add(key);

          }

        }

      }



      return normalized;

    }



    async function lookupIsbnLanguages(

      isbnValue: string

    ) {

      try {

        const params =

          new URLSearchParams({

            q: `isbn:${isbnValue}`,

            maxResults: "5",

            printType: "books",

          });



        if (googleApiKey) {

          params.set(

            "key",

            googleApiKey

          );

        }



        const response = await fetch(

          `https://www.googleapis.com/books/v1/volumes?${params.toString()}`

        );



        if (!response.ok) {

          return [];

        }



        const data =

          await response.json();



        return Array.from(

          expandLanguageKeys(

            (data?.items ?? [])

              .map(

                (item: any) =>

                  item?.volumeInfo

                    ?.language

              )

              .filter(Boolean)

          )

        ) as string[];

      } catch (_) {

        return [];

      }

    }



    // -----------------------------------

    // STEP 1:

    // Find the Hardcover book by ISBN

    // and identify its series membership.

    // -----------------------------------



    const findBookQuery = `

      query FindBookByISBN($isbn: String!) {

        editions(

          where: {

            _or: [

              { isbn_13: { _eq: $isbn } }

              { isbn_10: { _eq: $isbn } }

            ]

          }

          limit: 5

        ) {

          id

          isbn_10

          isbn_13



          language {

            code2

            code3

            language

          }



          book {

            id

            title

            slug

            release_date

            cached_image

            compilation



            contributions {

              author {

                id

                name

              }

            }



            editions(limit: 25) {

              isbn_10

              isbn_13



              language {

                code2

                code3

                language

              }

            }



            book_series {

              position



              series {

                id

                name

                slug

              }

            }

          }

        }

      }

    `;



    let editionWithSeries: any =
      null;

    let currentBook: any =
      null;

    let matchedIsbn =
      requestedIsbns[0] ?? "";

    for (
      const isbnCandidate of
        requestedIsbns
    ) {
      const bookResponse =
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
              query: findBookQuery,
              variables: {
                isbn:
                  isbnCandidate,
              },
            }),
          }
        );

      const bookJson =
        await bookResponse.json();

      if (
        !bookResponse.ok ||
        (
          bookJson.errors &&
          bookJson.errors.length > 0
        )
      ) {
        continue;
      }

      const editions =
        bookJson?.data?.editions ??
        [];

      const match =
        editions.find(
          (edition: any) =>
            edition.book?.book_series
              ?.length
        );

      if (match) {
        editionWithSeries =
          match;

        currentBook =
          match.book;

        matchedIsbn =
          isbnCandidate;

        break;
      }
    }

    // Some Google editions use an ISBN that Hardcover
    // has not attached to the canonical book. When
    // every ISBN misses, use Hardcover's own full-text
    // Book search, then resolve the chosen result back
    // to a full book record with series membership.
    if (
      !currentBook &&
      requestedTitle
    ) {
      const searchQuery = `
        query HardcoverSearch(
          $query: String!
        ) {
          search(
            query: $query
            query_type: "Book"
            per_page: 50
            page: 1
            fields: "title,author_names,isbns,alternative_titles"
            weights: "5,4,5,1"
            typos: "2,2,0,2"
            sort: "_text_match:desc,ratings_count:desc"
          ) {
            results
          }
        }
      `;

      const primaryAuthor =
        requestedAuthors[0] ?? "";

      const searchResponse =
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
                searchQuery,
              variables: {
                query:
                  primaryAuthor
                    ? `${requestedTitle} ${primaryAuthor}`
                    : requestedTitle,
              },
            }),
          }
        );

      const searchJson =
        await searchResponse.json();

      const searchResults =
        searchJson?.data
          ?.search?.results;

      const rawHits =
        searchResults &&
        typeof searchResults ===
          "object" &&
        !Array.isArray(
          searchResults
        ) &&
        Array.isArray(
          searchResults.hits
        )
          ? searchResults.hits
          : [];

      function normalizeSearchText(
        value: unknown
      ) {
        return String(
          value ?? ""
        )
          .toLowerCase()
          .normalize(
            "NFKD"
          )
          .replace(
            /[\u0300-\u036f]/g,
            ""
          )
          .replace(
            /[^a-z0-9]+/g,
            " "
          )
          .trim();
      }

      const wantedTitle =
        normalizeSearchText(
          requestedTitle
        );

      const wantedAuthors =
        requestedAuthors.map(
          normalizeSearchText
        );

      const scoredHits =
        rawHits
          .map(
            (
              hit: any
            ) =>
              hit?.document ??
              null
          )
          .filter(Boolean)
          .map(
            (
              document: any
            ) => {
              let score =
                0;

              const title =
                normalizeSearchText(
                  document.title
                );

              if (
                title ===
                  wantedTitle
              ) {
                score +=
                  250;
              } else if (
                title.includes(
                  wantedTitle
                ) ||
                wantedTitle.includes(
                  title
                )
              ) {
                score +=
                  120;
              }

              const actualAuthors =
                Array.isArray(
                  document.author_names
                )
                  ? document.author_names.map(
                      normalizeSearchText
                    )
                  : [];

              if (
                wantedAuthors.some(
                  (
                    expected
                  ) =>
                    actualAuthors.some(
                      (
                        actual
                      ) =>
                        actual ===
                          expected ||
                        actual.includes(
                          expected
                        ) ||
                        expected.includes(
                          actual
                        )
                    )
                )
              ) {
                score +=
                  180;
              }

              return {
                id:
                  Number(
                    document.id ??
                    0
                  ),
                score,
              };
            }
          )
          .filter(
            (
              item
            ) =>
              item.id >
                0 &&
              item.score >
                0
          )
          .sort(
            (
              a,
              b
            ) =>
              b.score -
              a.score
          );

      const bestId =
        scoredHits[0]?.id ??
        null;

      if (
        bestId
      ) {
        const fullBookQuery = `
          query HardcoverBookById(
            $id: Int!
          ) {
            books(
              where: {
                id: {
                  _eq: $id
                }
              }
              limit: 1
            ) {
              id
              title
              slug
              release_date
              cached_image
              compilation

              contributions {
                author {
                  id
                  name
                }
              }

              editions(limit: 25) {
                isbn_10
                isbn_13

                language {
                  code2
                  code3
                  language
                }
              }

              book_series {
                position

                series {
                  id
                  name
                  slug
                }
              }
            }
          }
        `;

        const fullBookResponse =
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
              body:
                JSON.stringify({
                  query:
                    fullBookQuery,
                  variables: {
                    id:
                      bestId,
                  },
                }),
            }
          );

        const fullBookJson =
          await fullBookResponse
            .json();

        const resolved =
          fullBookJson?.data
            ?.books?.[0] ??
          null;

        if (
          resolved
            ?.book_series
            ?.length
        ) {
          currentBook =
            resolved;

          editionWithSeries = {
            book:
              resolved,
            language:
              resolved
                ?.editions?.[0]
                ?.language ??
              null,
          };
        }
      }
    }

    // Use the language of the exact ISBN-matched

    // edition as Novori's preferred language for

    // this series lookup. This keeps the cleanup

    // generic: English ISBNs prefer English records,

    // Spanish ISBNs prefer Spanish records, etc.

    let preferredLanguageKeys =

      expandLanguageKeys([

        editionWithSeries?.language?.code2,

        editionWithSeries?.language?.code3,

        editionWithSeries?.language?.language,

      ]);



    // Hardcover sometimes leaves the exact edition's

    // language blank even when the ISBN is known.

    // In that case, ISBN lookup through Google Books

    // gives us a much more reliable preferred language

    // than trying to infer it from a title.

    if (

      preferredLanguageKeys.size === 0

    ) {

      const isbnLanguages =

        await lookupIsbnLanguages(

          String(matchedIsbn)

        );



      preferredLanguageKeys =

        expandLanguageKeys(

          isbnLanguages

        );

    }



    const membership =

      currentBook?.book_series?.[0];



    const series =

      membership?.series;



    if (!series) {

      return new Response(

        JSON.stringify({

          series: null,

          books: [],

        }),

        {

          status: 200,

          headers: {

            ...corsHeaders,

            "Content-Type": "application/json",

          },

        }

      );

    }



    // -----------------------------------

    // STEP 2:

    // Get every Hardcover book attached

    // to that series.

    // -----------------------------------



    const seriesQuery = `

      query GetSeries($seriesId: Int!) {

        series_by_pk(id: $seriesId) {

          id

          name

          slug



          book_series(

            order_by: {

              position: asc

            }

          ) {

            position



            book {

              id

              title

              slug

              release_date

              cached_image

              compilation



              contributions {

                author {

                  id

                  name

                }

              }



              editions(limit: 25) {

                isbn_10

                isbn_13



                language {

                  code2

                  code3

                  language

                }

              }

            }

          }

        }

      }

    `;



    const seriesResponse = await fetch(

      "https://api.hardcover.app/v1/graphql",

      {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,

        },

        body: JSON.stringify({

          query: seriesQuery,

          variables: {

            seriesId: series.id,

          },

        }),

      }

    );



    const seriesJson =

      await seriesResponse.json();



    if (!seriesResponse.ok) {

      return new Response(

        JSON.stringify({

          error:

            "Hardcover series lookup failed",

          details: seriesJson,

        }),

        {

          status: seriesResponse.status,

          headers: {

            ...corsHeaders,

            "Content-Type": "application/json",

          },

        }

      );

    }



    if (

      seriesJson.errors &&

      seriesJson.errors.length > 0

    ) {

      return new Response(

        JSON.stringify({

          error:

            "Hardcover series lookup returned GraphQL errors",

          details: seriesJson.errors,

        }),

        {

          status: 500,

          headers: {

            ...corsHeaders,

            "Content-Type": "application/json",

          },

        }

      );

    }



    const fullSeries =

      seriesJson?.data?.series_by_pk;



    const rawSeriesBooks =

      fullSeries?.book_series ?? [];



    // -----------------------------------

    // STEP 3:

    // Normalize Hardcover records.

    // -----------------------------------



    function normalizeBookRecord(

      item: any

    ) {

      const book = item?.book;



      const authors =

        book?.contributions

          ?.map(

            (contribution: any) =>

              contribution.author?.name

          )

          .filter(Boolean) ?? [];



      const isbns =

        book?.editions

          ?.flatMap(

            (edition: any) => [

              edition.isbn_13,

              edition.isbn_10,

            ]

          )

          .filter(Boolean) ?? [];



      const uniqueIsbns =

        Array.from(

          new Set(isbns)
        );



      const languageKeys =

        book?.editions

          ?.flatMap(

            (edition: any) => [

              edition.language?.code2,

              edition.language?.code3,

              edition.language?.language,

            ]

          )

          .filter(Boolean)

          .map((value: string) =>

            value.toLowerCase().trim()

          ) ?? [];



      const uniqueLanguageKeys =

        Array.from(

          new Set(languageKeys)

        );



      const matchesPreferredLanguage =

        preferredLanguageKeys.size > 0 &&

        uniqueLanguageKeys.some(

          (languageKey: string) =>

            preferredLanguageKeys.has(

              languageKey

            )

        );



      const imageUrl =

        typeof book?.cached_image ===

        "string"

          ? book.cached_image

          : book?.cached_image?.url ??

            null;



      return {

        position:

          item?.position ?? null,



        id:

          book?.id ?? null,



        title:

          book?.title ?? "Untitled",



        slug:

          book?.slug ?? null,



        releaseDate:

          book?.release_date ?? null,



        imageUrl,



        authors,



        isbns: uniqueIsbns,



        // Hardcover marks omnibuses, boxed sets,

        // and other multi-book records as compilations.

        // Keep this internal so Novori can exclude

        // them from canonical series entries.

        _isCompilation:

          book?.compilation === true,



        // Internal cleanup metadata. These fields

        // are removed before the response is sent.

        _languageKeys:

          uniqueLanguageKeys,



        _matchesPreferredLanguage:

          matchesPreferredLanguage,

      };

    }



    function isFormatOnlyVariant(

      book: any

    ) {

      const title =

        (

          book?.title ?? ""

        )

          .toLowerCase()

          .trim();



      // Be conservative here.

      //

      // Some decimal positions are legitimate in

      // series (especially .5 novellas/prequels),

      // so format filtering should never depend on

      // the title's position alone.

      //

      // Only remove records whose title

      // explicitly identifies them as an

      // alternate audio/adaptation format.

      const explicitFormatMarkers = [

        "dramatized adaptation",

        "graphic audio",

        "audio adaptation",

      ];



      return explicitFormatMarkers.some(

        (marker) =>

          title.includes(marker)

      );

    }



    const normalizedBooks =

      rawSeriesBooks

        .map(

          (item: any) =>

            normalizeBookRecord(item)

        )

        .filter((book: any) => {

          if (

            typeof book.position !==

              "number" ||

            !Number.isFinite(

              book.position

            )

          ) {

            return false;

          }



          // Hardcover occasionally includes

          // a placeholder position 0. Novori

          // should never display that as a

          // series entry. Legitimate 0.5

          // prequels/novellas are still kept.

          if (book.position === 0) {

            return false;

          }



          // Hardcover has a native compilation flag.

          // Boxed sets, omnibuses, and other records

          // that combine multiple books should never

          // appear as a canonical series installment.

          if (book._isCompilation) {

            return false;

          }



          // Novori intentionally shows only

          // canonical whole-number entries

          // and half-step entries:

          //

          // 1, 2, 3, 4...

          // 0.5, 1.5, 2.5, 3.5...

          //

          // This prevents Hardcover format

          // splits such as 1.1, 1.2, 2.1,

          // 2.2 from cluttering the series.

          const doubledPosition =

            book.position * 2;



          const isWholeOrHalfStep =

            Math.abs(

              doubledPosition -

                Math.round(

                  doubledPosition

                )

            ) < 0.000001;



          if (!isWholeOrHalfStep) {

            return false;

          }



          // Also remove records that are

          // explicitly labeled as alternate

          // audio/adaptation formats.

          if (

            isFormatOnlyVariant(

              book

            )

          ) {

            return false;

          }



          return true;

        });



    // -----------------------------------

    // STEP 4:

    // Pick one best Hardcover record per

    // actual series position.

    // -----------------------------------



    const currentAuthorNames =

      currentBook?.contributions

        ?.map(

          (contribution: any) =>

            contribution.author?.name

        )

        .filter(Boolean) ?? [];



    function scoreBook(book: any) {

      let score = 0;



      const title =

        book.title?.trim() ?? "";



      const authorNames =

        book.authors ?? [];



      if (

        book.isbns.length > 0

      ) {

        score += 100;

      }



      // Prefer a candidate that has an edition

      // matching the language of the ISBN the user

      // opened. This is much safer than guessing

      // language from the title text.

      if (

        book._matchesPreferredLanguage

      ) {

        score += 150;

      } else if (

        preferredLanguageKeys.size > 0 &&

        book._languageKeys?.length > 0

      ) {

        score -= 75;

      }



      if (

        currentAuthorNames.length >

          0 &&

        authorNames.some(

          (author: string) =>

            currentAuthorNames.includes(

              author

            )

        )

      ) {

        score += 80;

      }



      if (

        authorNames.length === 1

      ) {

        score += 15;

      }



      if (

        title &&

        title.toLowerCase() !==

          "untitled"

      ) {

        score += 30;

      }



      if (book.imageUrl) {

        score += 20;

      }



      if (book.slug) {

        score += 5;

      }



      const nonAscii =

        title.match(

          /[^\x00-\x7F]/g

        )?.length ?? 0;



      score -= nonAscii * 2;



      return score;

    }



    const booksByPosition =

      new Map<number, any[]>();



    for (

      const book of normalizedBooks

    ) {

      const existing =

        booksByPosition.get(

          book.position

        ) ?? [];



      existing.push(book);



      booksByPosition.set(

        book.position,

        existing

      );

    }



    let cleanedBooks =

      Array.from(

        booksByPosition.entries()

      )

        .map(

          ([position, candidates]) => {

            const sorted =

              [...candidates].sort(

                (a, b) =>

                  scoreBook(b) -

                  scoreBook(a)

              );



            const best = sorted[0];



            return {

              ...best,

              position,

            };

          }

        )

        .sort(

          (a, b) =>

            a.position - b.position

        );



    // -----------------------------------

    // STEP 4B:

    // Remove foreign-language-only .5

    // duplicates when the ISBN that started

    // the lookup gives us a preferred language.

    //

    // First trust Hardcover's edition language.

    // If a .5 record has NO Hardcover language

    // metadata at all, do one conservative

    // Google Books title lookup as a fallback.

    // If that lookup cannot confidently identify

    // a language, keep the book rather than guess.

    // -----------------------------------



    const googleLanguageCache =

      new Map<string, string[]>();



    function normalizeLookupTitle(

      value: string

    ) {

      return value

        .toLowerCase()

        .normalize("NFKD")

        .replace(/[\u0300-\u036f]/g, "")

        .replace(/[^a-z0-9]+/g, " ")

        .trim();

    }



    async function lookupTitleLanguages(

      book: any

    ) {

      const title =

        book?.title?.trim();



      if (!title) {

        return [];

      }



      const author =

        book?.authors?.[0]?.trim() ??

        "";



      const cacheKey =

        `${title}::${author}`;



      const cached =

        googleLanguageCache.get(

          cacheKey

        );



      if (cached) {

        return cached;

      }



      try {

        const queryParts = [

          `intitle:"${title}"`,

        ];



        if (author) {

          queryParts.push(

            `inauthor:"${author}"`

          );

        }



        const params =

          new URLSearchParams({

            q: queryParts.join(" "),

            maxResults: "10",

            printType: "books",

          });



        if (googleApiKey) {

          params.set(

            "key",

            googleApiKey

          );

        }



        const response =

          await fetch(

            `https://www.googleapis.com/books/v1/volumes?${params.toString()}`

          );



        if (!response.ok) {

          googleLanguageCache.set(

            cacheKey,

            []

          );

          return [];

        }



        const data =

          await response.json();



        const wantedTitle =

          normalizeLookupTitle(title);



        const matchingItems =

          (data?.items ?? []).filter(

            (item: any) => {

              const resultTitle =

                normalizeLookupTitle(

                  item?.volumeInfo?.title ??

                    ""

                );



              if (!resultTitle) {

                return false;

              }



              const titleMatches =

                resultTitle ===

                  wantedTitle ||

                resultTitle.includes(

                  wantedTitle

                ) ||

                wantedTitle.includes(

                  resultTitle

                );



              if (!titleMatches) {

                return false;

              }



              if (!author) {

                return true;

              }



              const resultAuthors =

                item?.volumeInfo?.authors ??

                [];



              return resultAuthors.some(

                (resultAuthor: string) =>

                  resultAuthor

                    .toLowerCase()

                    .includes(

                      author.toLowerCase()

                    ) ||

                  author

                    .toLowerCase()

                    .includes(

                      resultAuthor.toLowerCase()

                    )

              );

            }

          );



        const languages =

          Array.from(

            expandLanguageKeys(

              matchingItems

                .map(

                  (item: any) =>

                    item?.volumeInfo

                      ?.language

                )

                .filter(Boolean)

            )

          ) as string[];



        googleLanguageCache.set(

          cacheKey,

          languages

        );



        return languages;

      } catch (_) {

        googleLanguageCache.set(

          cacheKey,

          []

        );

        return [];

      }

    }



    if (

      preferredLanguageKeys.size > 0

    ) {

      const languageCleanedBooks = [];



      for (

        const book of cleanedBooks

      ) {
        const isHalfStep =

          !Number.isInteger(

            book.position

          ) &&

          Math.abs(

            book.position * 2 -

              Math.round(

                book.position * 2

              )

          ) < 0.000001;



        if (!isHalfStep) {

          languageCleanedBooks.push(

            book

          );

          continue;

        }



        const hasLanguageMetadata =

          book._languageKeys?.length > 0;



        if (hasLanguageMetadata) {

          if (

            book._matchesPreferredLanguage

          ) {

            languageCleanedBooks.push(

              book

            );

          }



          continue;

        }



        const fallbackLanguages =

          await lookupTitleLanguages(

            book

          );



        // If neither Hardcover nor Google Books can

        // verify the language of a .5 record, only

        // keep it when it at least has an ISBN. This

        // prevents sparse translation/duplicate rows

        // with no catalog identity from leaking into

        // the Novori series list.

        if (

          fallbackLanguages.length === 0

        ) {

          if (

            book.isbns?.length > 0

          ) {

            languageCleanedBooks.push(

              book

            );

          }



          continue;

        }



        const matchesPreferredFallback =

          fallbackLanguages.some(

            (language: string) =>

              preferredLanguageKeys.has(

                language

              )

          );



        if (matchesPreferredFallback) {

          languageCleanedBooks.push(

            book

          );

        }

      }



      cleanedBooks =

        languageCleanedBooks;

    }



    // -----------------------------------

    // STEP 5:

    // Defensive fallback:

    // if the current real book has a

    // legitimate decimal position such as

    // 3.5 but the series query omitted it,

    // insert it.

    // -----------------------------------



    const currentPosition =

      membership?.position ?? null;



    if (

      typeof currentPosition ===

        "number" &&

      Number.isFinite(

        currentPosition

      ) &&

      currentBook

    ) {

      const currentNormalized =

        normalizeBookRecord({

          position:

            currentPosition,

          book: currentBook,

        });



      const currentDoubledPosition =

        currentPosition * 2;



      const currentIsWholeOrHalfStep =

        Math.abs(

          currentDoubledPosition -

            Math.round(

              currentDoubledPosition

            )

        ) < 0.000001;



      const currentIsHalfStep =

        !Number.isInteger(

          currentPosition

        ) &&

        currentIsWholeOrHalfStep;



      const currentHasLanguageMetadata =

        currentNormalized

          ._languageKeys?.length > 0;



      let currentLanguageIsAllowed =

        true;



      if (

        currentIsHalfStep &&

        preferredLanguageKeys.size > 0

      ) {

        if (

          currentHasLanguageMetadata

        ) {

          currentLanguageIsAllowed =

            Boolean(

              currentNormalized

                ._matchesPreferredLanguage

            );

        } else {

          const currentFallbackLanguages =

            await lookupTitleLanguages(

              currentNormalized

            );



          if (

            currentFallbackLanguages.length >

            0

          ) {

            currentLanguageIsAllowed =

              currentFallbackLanguages.some(

                (language: string) =>

                  preferredLanguageKeys.has(

                    language

                  )

              );

          } else {

            currentLanguageIsAllowed =

              currentNormalized

                .isbns?.length > 0;

          }

        }

      }



      const currentIsRealEntry =

        currentPosition !== 0 &&

        currentIsWholeOrHalfStep &&

        currentLanguageIsAllowed &&

        !currentNormalized._isCompilation &&

        !isFormatOnlyVariant(

          currentNormalized

        );



      const hasCurrentPosition =

        cleanedBooks.some(

          (book: any) =>

            book.position ===

            currentPosition

        );



      if (

        currentIsRealEntry &&

        !hasCurrentPosition

      ) {

        cleanedBooks = [

          ...cleanedBooks,

          currentNormalized,

        ].sort(

          (a, b) =>

            a.position - b.position

        );

      }

    }



    // Remove internal language-scoring fields

    // before returning the public response shape

    // expected by the Novori client.

    const responseBooks =

      cleanedBooks.map((book: any) => {

        const {

          _isCompilation,

          _languageKeys,

          _matchesPreferredLanguage,

          ...publicBook

        } = book;



        return publicBook;

      });



    // -----------------------------------

    // STEP 6:

    // Send clean data back to Novori.

    // -----------------------------------



    return new Response(

      JSON.stringify({

        series: {

          id:

            fullSeries?.id ??

            series.id,



          name:

            fullSeries?.name ??

            series.name,



          slug:

            fullSeries?.slug ??

            series.slug,



          currentPosition,

        },



        books: responseBooks,

      }),

      {

        status: 200,

        headers: {

          ...corsHeaders,

          "Content-Type": "application/json",

        },

      }

    );

  } catch (error) {

    return new Response(

      JSON.stringify({

        error:

          "Unexpected error",

        details: String(error),

      }),

      {

        status: 500,

        headers: {

          ...corsHeaders,

          "Content-Type": "application/json",

        },

      }

    );

  }

});



