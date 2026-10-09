import { readEditionCovers } from '../_shared/edition-cover-catalog.ts';
import { matchesSeriesCatalogEdition } from '../_shared/series-book-catalog.ts';
import { getServerKey } from "../_shared/supabase-keys.mjs";
import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';
import { readCatalogPublications } from '../_shared/book-publication-cache.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin':
    '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type':
          'application/json',
        'Cache-Control':
          'no-store',
      },
    }
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

    if (
      request.method !==
      'POST'
    ) {
      return jsonResponse(
        {
          ok: false,
          status: 405,
          error:
            'Method not allowed.',
        },
        405
      );
    }

    try {
      const supabaseUrl =
        Deno.env.get(
          'SUPABASE_URL'
        );

      const serviceRoleKey =
        getServerKey(name => Deno.env.get(name));

      if (
        !supabaseUrl ||
        !serviceRoleKey
      ) {
        throw new Error(
          'Supabase service credentials are not configured.'
        );
      }

      const authorization =
        request.headers.get(
          'Authorization'
        ) ?? '';

      const accessToken =
        authorization
          .replace(
            /^Bearer\s+/i,
            ''
          )
          .trim();

      if (!accessToken) {
        return jsonResponse(
          {
            ok: false,
            status: 401,
            error:
              'Authentication required.',
          }
        );
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

      const {
        data:
          authData,
        error:
          authError,
      } =
        await supabaseAdmin
          .auth
          .getUser(
            accessToken
          );

      if (
        authError ||
        !authData?.user
      ) {
        return jsonResponse(
          {
            ok: false,
            status: 401,
            error:
              'Invalid session.',
          }
        );
      }

      const body =
        await request.json();

      const singleVolumeId =
        typeof body?.volumeId ===
          'string'
          ? body.volumeId
              .trim()
          : '';

      const requestedVolumeIds =
        Array.isArray(
          body?.volumeIds
        )
          ? body.volumeIds
              .filter(
                (
                  value: unknown
                ): value is string =>
                  typeof value ===
                  'string'
              )
              .map(
                (
                  value: string
                ) =>
                  value.trim()
              )
          : [];

      const requestedIsbns = Array.isArray(body?.isbns)
        ? Array.from(new Set(body.isbns.filter((value: unknown): value is string => typeof value === 'string')
            .map((value: string) => value.replace(/[^0-9Xx]/g, '').toUpperCase()))) as string[]
        : [];
      if (requestedIsbns.length > 400 || requestedIsbns.some(value => !/^(?:[0-9]{13}|[0-9]{9}[0-9X])$/.test(value))) {
        return jsonResponse({ ok: false, status: 400, error: 'Invalid ISBN request.' });
      }

      const volumeIds =
        Array.from(
          new Set(
            [
              ...(singleVolumeId
                ? [
                    singleVolumeId,
                  ]
                : []),
              ...requestedVolumeIds,
            ].filter(
              Boolean
            )
          )
        );

      if (
        (volumeIds.length === 0 && requestedIsbns.length === 0) ||
        volumeIds.length >
          200 ||
        volumeIds.some(
          (
            volumeId
          ) =>
            volumeId.length >
              200 ||
            !/^[A-Za-z0-9_-]+$/.test(
              volumeId
            )
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            status: 400,
            error:
              'Invalid Google Books volume ID request.',
          }
        );
      }

      const {
        data:
          editions,
        error:
          editionError,
      } =
        await supabaseAdmin
          .from(
            'book_editions'
          )
          .select(
            'id,provider,provider_book_id, work_id, isbn_10, isbn_13, language, metadata'
          )
          .in('provider', ['google_books', 'isbndb'])
          .in(
            'provider_book_id',
            volumeIds
          );

      if (editionError) {
        throw new Error(
          `Could not read Novori editions: ${editionError.message}`
        );
      }

      const editionRows = editions ?? [];
      for (const column of ['isbn_10', 'isbn_13'] as const) {
        const wanted = requestedIsbns.filter(value => value.length === (column === 'isbn_10' ? 10 : 13));
        if (!wanted.length) continue;
        const { data: isbnEditions, error: isbnError } = await supabaseAdmin
          .from('book_editions').select('id,provider,provider_book_id, work_id, isbn_10, isbn_13, language, metadata')
          .in('provider', ['google_books', 'isbndb']).in(column, wanted);
        if (isbnError) throw new Error(`Could not read ISBN cover identities: ${isbnError.message}`);
        for (const edition of isbnEditions ?? []) {
          editionRows.push(edition);
        }
      }

      const choicesById = await readEditionCovers(supabaseAdmin, editionRows);
      const covers: Record<string, string | null> = {};
      const details: Record<string, Record<string, unknown>> = {};
      for (const key of [...volumeIds, ...requestedIsbns.map(isbn => `isbn:${isbn}`)]) {
        const matching = editionRows.filter((row: any) => key.startsWith('isbn:')
          ? [row.isbn_10, row.isbn_13].includes(key.slice(5)) : row.provider_book_id === key);
        // An ambiguous ISBN must not borrow an unrelated author's cover.
        const seed = matching[0];
        const safe = seed && matching.every((row: any) => row.work_id === seed.work_id ||
          matchesSeriesCatalogEdition(seed.metadata?.volumeInfo ?? {}, row));
        const choices = safe ? choicesById.get(seed.provider_book_id) ?? [] : [];
        const first = choices[0];
        covers[key] = first?.url ?? null;
        details[key] = {
          workId: first?.workId ?? (seed ? `edition:${seed.provider_book_id}` : null),
          catalogWorkId: seed?.work_id ?? null,
          scope: first?.provider === 'hardcover' ? 'work' : 'edition', selectorVersion: 8,
          genres: first?.genres ?? [], reviewsCount: first?.reviewsCount ?? null, aliases: first?.aliases ?? [],
          url: first?.url ?? null, provider: first?.provider ?? null,
          fallback: first?.fallback === true, locked: first?.locked ?? false, authoritative: Boolean(first),
          selectionStatus: first ? 'selected' : 'unavailable',
          alternatives: choices.map(choice => choice.url),
          coverBookId: first?.bookId ?? null,
        };
      }

      if (
        singleVolumeId &&
        requestedVolumeIds.length ===
          0 && requestedIsbns.length === 0
      ) {
        return jsonResponse(
          {
            ok: true,
            status: 200,
            data: details[
              singleVolumeId
            ],
          }
        );
      }

      return jsonResponse(
        {
          ok: true,
          status: 200,
          data: {
            covers,
            details,
            publications: await readCatalogPublications(supabaseAdmin, editionRows),
          },
        }
      );
    } catch (
      error
    ) {
      console.error(
        'book-cover-selection failed:',
        error
      );

      return jsonResponse(
        {
          ok: false,
          status: 500,
          error:
            'Could not load the selected book cover.',
        },
        500
      );
    }
  }
);
