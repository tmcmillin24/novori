import {
  supabase,
} from './supabase';

export type CanonicalBookPresentation = {
  googleBookId: string;
  title: string;
  authors: string[];
  isbn: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  coverUrl: string | null;
  imageLinks:
    | {
        smallThumbnail?: string;
        thumbnail?: string;
        small?: string;
        medium?: string;
        large?: string;
        extraLarge?: string;
      }
    | null;
};

function secureCoverUrl(
  url?: string | null
) {
  return (
    url?.replace(
      'http://',
      'https://'
    ) ??
    null
  );
}

export async function getCanonicalBookPresentations(
  googleBookIds:
    string[]
) {
  const ids =
    Array.from(
      new Set(
        googleBookIds.filter(
          Boolean
        )
      )
    );

  const books =
    new Map<
      string,
      CanonicalBookPresentation
    >();

  if (
    ids.length ===
      0
  ) {
    return books;
  }

  const BATCH_SIZE =
    200;

  for (
    let index = 0;
    index < ids.length;
    index +=
      BATCH_SIZE
  ) {
    const batch =
      ids.slice(
        index,
        index +
          BATCH_SIZE
      );

    try {
      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          'book-cover-selection',
          {
            body: {
              volumeIds:
                batch,
            },
          }
        );

      if (error) {
        console.warn(
          'Could not load canonical Novori book presentations:',
          error
        );
        continue;
      }

      const response =
        data as
          | {
              ok?: boolean;
              data?: {
                canonicalBooks?: Record<
                  string,
                  {
                    googleBookId?: string;
                    title?: string;
                    authors?: string[];
                    isbn?: string | null;
                    publishedDate?: string | null;
                    pageCount?: number | null;
                    coverUrl?: string | null;
                    imageLinks?: {
                      smallThumbnail?: string;
                      thumbnail?: string;
                      small?: string;
                      medium?: string;
                      large?: string;
                      extraLarge?: string;
                    } | null;
                  } | null
                >;
              };
            }
          | null;

      if (
        response?.ok !==
          true ||
        !response.data
          ?.canonicalBooks
      ) {
        continue;
      }

      for (
        const [
          sourceGoogleBookId,
          canonical,
        ] of Object.entries(
          response.data
            .canonicalBooks
        )
      ) {
        if (
          !canonical ||
          typeof canonical.googleBookId !==
            'string' ||
          typeof canonical.title !==
            'string'
        ) {
          continue;
        }

        books.set(
          sourceGoogleBookId,
          {
            googleBookId:
              canonical.googleBookId,
            title:
              canonical.title,
            authors:
              Array.isArray(
                canonical.authors
              )
                ? canonical.authors
                : [],
            isbn:
              typeof canonical.isbn ===
                'string'
                ? canonical.isbn
                : null,
            publishedDate:
              typeof canonical.publishedDate ===
                'string'
                ? canonical.publishedDate
                : null,
            pageCount:
              typeof canonical.pageCount ===
                'number'
                ? canonical.pageCount
                : null,
            coverUrl:
              secureCoverUrl(
                canonical.coverUrl
              ),
            imageLinks:
              canonical.imageLinks &&
              typeof canonical.imageLinks ===
                'object'
                ? canonical.imageLinks
                : null,
          }
        );
      }
    } catch (
      canonicalError
    ) {
      console.warn(
        'Could not load canonical Novori book presentations:',
        canonicalError
      );
    }
  }

  return books;
}
