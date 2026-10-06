import { getServerKey } from "./supabase-keys.mjs";
import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2";

type DiscoveryBook = {
  coverUrl?:
    | string
    | null;
  isbns?: unknown[];
  [key: string]: unknown;
};

function normalizeIsbn(
  value: unknown
) {
  return String(
    value ??
    ""
  )
    .replace(
      /[^0-9Xx]/g,
      ""
    )
    .toUpperCase();
}

function getServiceRoleKey() {

  let serviceRoleKey =
    getServerKey(name => Deno.env.get(name)) ??
    null;


  return serviceRoleKey;
}

export async function applyCanonicalDiscoveryCovers(
  payload: Record<
    string,
    unknown
  >
) {
  try {
    const books =
      Array.isArray(
        payload.books
      )
        ? (
            payload.books as
              DiscoveryBook[]
          )
        : [];

    if (
      books.length === 0
    ) {
      return payload;
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const serviceRoleKey =
      getServiceRoleKey();

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return payload;
    }

    const isbn10s =
      new Set<string>();
    const isbn13s =
      new Set<string>();

    for (
      const book of
        books
    ) {
      for (
        const rawIsbn of
          book.isbns ??
          []
      ) {
        const isbn =
          normalizeIsbn(
            rawIsbn
          );

        if (
          isbn.length ===
            10
        ) {
          isbn10s.add(
            isbn
          );
        } else if (
          isbn.length ===
            13
        ) {
          isbn13s.add(
            isbn
          );
        }
      }
    }

    if (
      isbn10s.size ===
        0 &&
      isbn13s.size ===
        0
    ) {
      return payload;
    }

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,
            persistSession:
              false,
          },
        }
      );

    type EditionRow = {
      work_id: string;
      isbn_10:
        | string
        | null;
      isbn_13:
        | string
        | null;
    };

    const editionRows:
      EditionRow[] = [];

    if (
      isbn13s.size >
      0
    ) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "book_editions"
          )
          .select(
            "work_id, isbn_10, isbn_13"
          )
          .eq(
            "provider",
            "google_books"
          )
          .in(
            "isbn_13",
            Array.from(
              isbn13s
            )
          );

      if (
        error
      ) {
        console.warn(
          "Could not read ISBN-13 catalog covers:",
          error.message
        );
      } else {
        editionRows.push(
          ...(
            (
              data ??
              []
            ) as EditionRow[]
          )
        );
      }
    }

    if (
      isbn10s.size >
      0
    ) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "book_editions"
          )
          .select(
            "work_id, isbn_10, isbn_13"
          )
          .eq(
            "provider",
            "google_books"
          )
          .in(
            "isbn_10",
            Array.from(
              isbn10s
            )
          );

      if (
        error
      ) {
        console.warn(
          "Could not read ISBN-10 catalog covers:",
          error.message
        );
      } else {
        editionRows.push(
          ...(
            (
              data ??
              []
            ) as EditionRow[]
          )
        );
      }
    }

    if (
      editionRows.length ===
        0
    ) {
      return payload;
    }

    const isbnToWorkId =
      new Map<
        string,
        string
      >();

    for (
      const edition of
        editionRows
    ) {
      for (
        const isbn of [
          edition.isbn_13,
          edition.isbn_10,
        ]
      ) {
        const normalized =
          normalizeIsbn(
            isbn
          );

        if (
          normalized &&
          !isbnToWorkId.has(
            normalized
          )
        ) {
          isbnToWorkId.set(
            normalized,
            edition.work_id
          );
        }
      }
    }

    const workIds =
      Array.from(
        new Set(
          editionRows.map(
            (
              edition
            ) =>
              edition.work_id
          )
        )
      );

    const {
      data:
        selections,
      error:
        selectionError,
    } =
      await supabaseAdmin
        .from(
          "book_cover_selections"
        )
        .select(
          "work_id, candidate_id"
        )
        .eq(
          "status",
          "selected"
        )
        .in(
          "work_id",
          workIds
        );

    if (
      selectionError ||
      !selections?.length
    ) {
      if (
        selectionError
      ) {
        console.warn(
          "Could not read canonical discovery cover selections:",
          selectionError.message
        );
      }

      return payload;
    }

    const candidateIds =
      Array.from(
        new Set(
          selections
            .map(
              (
                selection
              ) =>
                selection
                  .candidate_id
            )
            .filter(
              (
                candidateId
              ): candidateId is string =>
                typeof candidateId ===
                  "string" &&
                Boolean(
                  candidateId
                )
            )
        )
      );

    if (
      candidateIds.length ===
        0
    ) {
      return payload;
    }

    const {
      data:
        candidates,
      error:
        candidateError,
    } =
      await supabaseAdmin
        .from(
          "book_cover_candidates"
        )
        .select(
          "id, url"
        )
        .in(
          "id",
          candidateIds
        );

    if (
      candidateError
    ) {
      console.warn(
        "Could not read canonical discovery cover candidates:",
        candidateError.message
      );

      return payload;
    }

    const candidateUrlById =
      new Map<
        string,
        string
      >();

    for (
      const candidate of
        candidates ??
        []
    ) {
      const url =
        typeof candidate.url ===
          "string"
          ? candidate.url
              .replace(
                /^http:\/\//i,
                "https://"
              )
              .trim()
          : "";

      if (
        typeof candidate.id ===
          "string" &&
        url
      ) {
        candidateUrlById.set(
          candidate.id,
          url
        );
      }
    }

    const workCoverById =
      new Map<
        string,
        string
      >();

    for (
      const selection of
        selections
    ) {
      const coverUrl =
        candidateUrlById.get(
          selection.candidate_id
        );

      if (
        coverUrl
      ) {
        workCoverById.set(
          selection.work_id,
          coverUrl
        );
      }
    }

    let changed =
      false;

    const overlaidBooks =
      books.map(
        (
          book
        ) => {
          let canonicalCover:
            | string
            | null =
            null;

          for (
            const rawIsbn of
              book.isbns ??
              []
          ) {
            const isbn =
              normalizeIsbn(
                rawIsbn
              );

            const workId =
              isbnToWorkId.get(
                isbn
              );

            if (
              !workId
            ) {
              continue;
            }

            const selectedCover =
              workCoverById.get(
                workId
              );

            if (
              selectedCover
            ) {
              canonicalCover =
                selectedCover;
              break;
            }
          }

          if (
            !canonicalCover ||
            canonicalCover ===
              book.coverUrl
          ) {
            return book;
          }

          changed =
            true;

          return {
            ...book,
            coverUrl:
              canonicalCover,
          };
        }
      );

    return changed
      ? {
          ...payload,
          books:
            overlaidBooks,
        }
      : payload;
  } catch (
    error
  ) {
    console.warn(
      "Could not overlay canonical discovery covers:",
      error
    );

    return payload;
  }
}
