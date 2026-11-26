import { findSeriesBookByTitle, seriesResultLifetime, verifiedSeriesMembership } from '../_shared/series-lookup.ts';
import { providerTrace, noteProviderCache } from '../_shared/provider-observability.ts';
import { cacheSeriesEditionPages } from '../_shared/edition-pages.ts';
import { readSeriesMembership, cacheSeriesMembership } from '../_shared/series-membership-cache.ts';
import { cleanCatalogBookTitle, normalizeCatalogAuthor } from '../_shared/book-edition-metadata.ts';
import { verifiedEnglishSeriesArt } from '../_shared/verified-series-covers.ts';
import { getServerKey } from "../_shared/supabase-keys.mjs";
import { attachDiscoveryCatalogCovers } from '../_shared/discovery-cover-catalog.ts';
import { hardcoverTextEdition } from '../_shared/hardcover-discovery-policy.ts';
import { hardcoverDiscoveryArt } from '../_shared/hardcover-discovery-covers.ts';
import { cacheSeriesPublications } from '../_shared/book-publication-cache.ts';
import { isbnDbEnabled } from '../_shared/isbndb.ts';
import { englishEditionIsbns, isEnglishBookLanguage } from '../_shared/book-language.ts';
import { cachedProviderValue, cachedHardcoverFetch, cachedGoogleQuery, createCacheAdmin, requireReader } from '../_shared/provider-cache.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { selectCanonicalGoogleCoversForWorkIds } from "../_shared/book-cover-selector.ts";

Deno.serve(async (req) => {
  let requestTrace:ReturnType<typeof providerTrace>|undefined;

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
          .filter(isbn => /^(?:\d{9}[\dX]|\d{13})$/.test(isbn))
      )
    ).slice(0,8);

    const requestedTitle =
      typeof body?.title === "string"
        ? body.title.trim()
        : "";

    const requestedAuthors: string[] =
      Array.isArray(body?.authors)
        ? body.authors
            .filter(
              (author: string) =>
                typeof author === "string" &&
                author.trim()
            )
            .map((author: string) =>
              author.trim()
            )
        : [];

    const requestedGoogleBookId =
      typeof body?.googleBookId === "string"
        ? body.googleBookId.trim()
        : "";

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



    const supabaseUrl =

      Deno.env.get(

        "SUPABASE_URL"

      ) ?? "";



    const serviceRoleKey =

      getServerKey(name => Deno.env.get(name)) ?? "";



    const userAccessToken =

      (req.headers.get(

        "Authorization"

      ) ?? "")

        .replace(

          /^Bearer\s+/i,

          ""

        )

        .trim();



    const supabaseAdmin = createCacheAdmin();requestTrace=providerTrace(supabaseAdmin);
    await requireReader(supabaseAdmin, req);
    let sourceExpiresAt = Infinity;
    const fetchHardcover = (url: string, init: RequestInit) => cachedHardcoverFetch(
      supabaseAdmin, url, init, 14 * 86400000, 90 * 86400000, 'hardcover_series',
      row => {
        if (row.response_json?.data?.series_by_pk) sourceExpiresAt = Date.parse(row.expires_at);
      },
      payload => {
        const data = payload?.data;
        if (data?.series_by_pk?.book_series?.length) return seriesResultLifetime(true);
        if (data?.search?.results?.hits?.length) return seriesResultLifetime(true);
        // A book record without a series link can gain one later.
        const books = data?.books ?? data?.editions?.map((edition: any)=>edition.book) ?? [];
        return seriesResultLifetime(Array.isArray(books) && books.some((book: any)=>book?.book_series?.length));
      }
    );
    const HARDCOVER_SERIES_CACHE_PROVIDER =

      "hardcover_series";



    const HARDCOVER_SERIES_CACHE_TTL_MS =

      14 * 24 * 60 * 60 * 1000;



    const HARDCOVER_SERIES_STALE_TTL_MS =

      90 * 24 * 60 * 60 * 1000;



    function normalizeSeriesCacheText(

      value: string

    ) {

      return value

        .toLowerCase()

        .normalize("NFKD")

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



    // Include the evidence used for lookup so an older edition's miss
    // cannot block a sibling edition. Verified memberships are reused above this cache.
    const hardcoverSeriesCacheKey = [
      'series:v6:verified-membership',
      normalizeSeriesCacheText(cleanCatalogBookTitle(requestedTitle)),
      requestedAuthors.map(author => normalizeSeriesCacheText(normalizeCatalogAuthor(author))).sort().join('|'),
      requestedIsbns.slice().sort().join(','),
    ].join('::');

    const knownMembership = await readSeriesMembership(supabaseAdmin,{title:requestedTitle,authors:requestedAuthors,coverBookId:requestedGoogleBookId,isbns:requestedIsbns});
    if (knownMembership) noteProviderCache(supabaseAdmin,'hardcover_series','hit-membership',hardcoverSeriesCacheKey);
    const responsePayload = knownMembership ?? await cachedProviderValue({
      admin: supabaseAdmin, provider: HARDCOVER_SERIES_CACHE_PROVIDER,
      key: hardcoverSeriesCacheKey, freshMs: HARDCOVER_SERIES_CACHE_TTL_MS,
      staleMs: HARDCOVER_SERIES_STALE_TTL_MS, leaseSeconds: 600, sourceExpiresAt: () => sourceExpiresAt,
      valueLifetime: (value: any) => seriesResultLifetime(Boolean(value?.series)),
      load: async () => {
    let quotaUserId:

      string | null | undefined =

      undefined;



    async function claimGoogleBooksRequest() {

      if (

        !supabaseAdmin ||

        !userAccessToken

      ) {

        console.warn(

          "hardcover-series blocked Google fallback: quota context unavailable"

        );

        return false;

      }



      if (

        quotaUserId ===

        undefined

      ) {

        const {

          data: authData,

          error: authError,

        } =

          await supabaseAdmin.auth.getUser(

            userAccessToken

          );



        quotaUserId =

          authError

            ? null

            : authData?.user?.id ??

              null;

      }



      if (!quotaUserId) {

        console.warn(

          "hardcover-series blocked Google fallback: invalid user session"

        );

        return false;

      }



      const {

        data: claimData,

        error: claimError,

      } =

        await supabaseAdmin.rpc(

          "novori_claim_google_books_search",

          {

            p_user_id:

              quotaUserId,

          }

        );



      if (claimError) {

        console.warn(

          "hardcover-series blocked Google fallback: quota claim failed",

          claimError.message

        );

        return false;

      }



      const claim =

        Array.isArray(

          claimData

        )

          ? claimData[0]

          : claimData;



      if (

        claim?.allowed !==

        true

      ) {

        console.info(

          `hardcover-series blocked Google fallback: ${claim?.reason ?? "rate_limited"}`

        );

        return false;

      }



      return true;

    }



    async function fetchGoogleBooksGuarded(

      url: string

    ) {

      return cachedGoogleQuery(supabaseAdmin, url, claimGoogleBooksRequest);
    }

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



        const response =

          await fetchGoogleBooksGuarded(

            `https://www.googleapis.com/books/v1/volumes?${params.toString()}`

          );



        if (

          !response ||

          !response.ok

        ) {

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



    const requestedIdentity = {title:requestedTitle,authors:requestedAuthors};
    const hardcoverQuery = async (query: string, variables: Record<string, unknown>) => {
      const response = await fetchHardcover("https://api.hardcover.app/v1/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({query,variables}),
      });
      return (await response.json()).data;
    };

    const findBookQuery = `

      query FindSeriesBooksByISBN($isbns: [String!]!) {

        editions(

          where: {

            _or: [

              { isbn_13: { _in: $isbns } }

              { isbn_10: { _in: $isbns } }

            ]

          }

          limit: 24

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



            editions(limit: 100
            where: { language: { code2: { _eq: "en" } } }
            order_by: [{ release_date: asc_nulls_last }, { id: asc }]) {
                id
                title
                image { url width height }
                reading_format { format }
                release_date
                compilation

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



    let currentBook: any = null;
    let lookupError: unknown = null;
    const isbns = requestedIsbns;
    if (isbns.length) {
      try {
        const data = await hardcoverQuery(findBookQuery,{isbns});
        if (!Array.isArray(data?.editions)) throw new Error('Hardcover ISBN response was incomplete.');
        for (const isbn of isbns) {
          const match = data.editions.find((edition: any) =>
            (edition.isbn_10 === isbn || edition.isbn_13 === isbn) &&
            (![edition.language?.code2,edition.language?.code3,edition.language?.language].some(Boolean) ||
              [edition.language?.code2,edition.language?.code3,edition.language?.language].some(isEnglishBookLanguage)) &&
            verifiedSeriesMembership(edition.book,requestedIdentity,true));
          if (match) { currentBook = match.book; break; }
        }
      } catch (error) { lookupError = error; }
    }
    const matchedByIsbn = Boolean(currentBook);
    if (!currentBook && requestedTitle && requestedAuthors.length) {
      const searchQuery = `
        query HardcoverSearch($query: String!) {
          search(query: $query, query_type: "Book", per_page: 50, page: 1,
            fields: "title,author_names,isbns,alternative_titles", weights: "5,4,5,1",
            typos: "2,2,0,2", sort: "_text_match:desc,ratings_count:desc") { results }
        }
      `;
      const seriesLookupFields = `
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

              editions(limit: 100
            where: { language: { code2: { _eq: "en" } } }
            order_by: [{ release_date: asc_nulls_last }, { id: asc }]) {
                id
                title
                image { url width height }
                reading_format { format }
                release_date
                compilation
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
      `;
      const readBooks = async (query: string, variables: Record<string,unknown>) => {
        const data = await hardcoverQuery(query,variables);
        if (!Array.isArray(data?.books)) throw new Error('Hardcover book response was incomplete.');
        return data.books;
      };
      currentBook = await findSeriesBookByTitle(requestedIdentity, {
        search: async query => {
          const data = await hardcoverQuery(searchQuery,{query});
          const hits = data?.search?.results?.hits;
          if (!Array.isArray(hits)) throw new Error('Hardcover search response was incomplete.');
          return hits.map((hit: any)=>hit?.document).filter(Boolean);
        },
        byIds: ids => readBooks(`query SeriesBooksById($ids: [Int!]!) {
          books(where:{ id:{_in:$ids} },limit:8) { ${seriesLookupFields} }
        }`,{ids}),
        byExactTitle: titles => {
          const variables:Record<string,unknown> = {};
          const clauses = titles.map((title,index)=>{
            variables[`title${index}`] = title.replace(/[\\%_]/g,'\\$&');
            return `{ title:{_ilike:$title${index}} }`;
          });
          return readBooks(`query ExactSeriesTitle(${Object.keys(variables).map(name=>`$${name}:String!`).join(',')}) {
            books(where:{ _or:[${clauses.join(',')}], book_series:{ series:{ id:{_gt:0} } } },limit:24) { ${seriesLookupFields} }
          }`,variables);
        },
      });
    }
    if (!currentBook && lookupError) throw lookupError;

    // Novori's English catalog must not inherit a mixed work's first edition language.
    const preferredLanguageKeys = expandLanguageKeys(['en', 'eng', 'english']);

    const membership = verifiedSeriesMembership(currentBook, requestedIdentity, matchedByIsbn);
    const series = membership?.series;
    if (!series) return {series:null,books:[]};

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



              editions(limit: 100
            where: { language: { code2: { _eq: "en" } } }
            order_by: [{ release_date: asc_nulls_last }, { id: asc }]) {
                id
                title
                image { url width height }
                reading_format { format }
                pages
                release_date
                compilation

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



    const seriesResponse = await fetchHardcover("https://api.hardcover.app/v1/graphql",

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



    const fullSeries = seriesJson?.data?.series_by_pk;
    if (!seriesResponse.ok || seriesJson?.errors?.length ||
        fullSeries?.id !== series.id || !Array.isArray(fullSeries.book_series)) {
      throw new Error('Hardcover series response was incomplete.');
    }
    await cacheSeriesEditionPages(supabaseAdmin,(fullSeries?.book_series ?? []).map((row: any)=>row.book).filter(Boolean),sourceExpiresAt);




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



      // Mixed-language works must not route taps to a translated edition's ISBN.
      const isbns = englishEditionIsbns(book?.editions);

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

          new Set<string>(languageKeys)

        );



      const matchesPreferredLanguage =

        preferredLanguageKeys.size > 0 &&

        uniqueLanguageKeys.some(

          (languageKey: string) =>

            preferredLanguageKeys.has(

              languageKey

            )

        );



      const coverEdition = verifiedEnglishSeriesArt(book);
      const imageUrl = coverEdition?.url ?? null;
      const coverProof = (book.editions ?? []).some((edition: any) => hardcoverTextEdition(edition, book.title, '9999-12-31'))
        ? hardcoverDiscoveryArt({ ...book, image: book.image ?? book.cached_image }) : null;

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
        coverEdition,
        coverProof,
        coverOrigin: 'series',
        formatPolicyVersion: 1,



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

          await fetchGoogleBooksGuarded(

            `https://www.googleapis.com/books/v1/volumes?${params.toString()}`

          );



        if (

          !response ||

          !response.ok

        ) {

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



    const seriesPayload = {

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

    };



    return seriesPayload;
      },
    });
    const verifiedPayload = await attachDiscoveryCatalogCovers(supabaseAdmin, { ...responsePayload, books: (responsePayload.books ?? []).map((row: any) => ({...row, coverOrigin: 'series', formatPolicyVersion: 1})) });
    await cacheSeriesPublications(supabaseAdmin, verifiedPayload);
    if (!knownMembership) await cacheSeriesMembership(supabaseAdmin, verifiedPayload, hardcoverSeriesCacheKey);
    return new Response(JSON.stringify({...verifiedPayload,cacheTrace:providerTrace(supabaseAdmin)}), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {

    return new Response(

      JSON.stringify({
        cacheTrace:requestTrace,

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


