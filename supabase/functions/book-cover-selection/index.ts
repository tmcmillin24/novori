import { preferredCoverIsbn } from '../_shared/catalog-cover-preferences.ts';
import { matchesSeriesCatalogEdition } from '../_shared/series-book-catalog.ts';
import { cachedWorkCovers } from '../_shared/catalog-metadata-covers.ts';
import { catalogCoverAliases } from '../_shared/catalog-cover-aliases.ts';
import { getServerKey } from "../_shared/supabase-keys.mjs";
import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';
import { readCatalogPublications } from '../_shared/book-publication-cache.ts';

import { selectCanonicalGoogleCoversForWorkIds } from '../_shared/book-cover-selector.ts';

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
            'provider_book_id, work_id, isbn_10, isbn_13, metadata'
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
      const isbnWorkIds = new Map<string, string>();
      const isbnCandidates = new Map<string, Set<string>>();
      for (const column of ['isbn_10', 'isbn_13'] as const) {
        const wanted = requestedIsbns.filter(value => value.length === (column === 'isbn_10' ? 10 : 13));
        if (!wanted.length) continue;
        const { data: isbnEditions, error: isbnError } = await supabaseAdmin
          .from('book_editions').select('provider_book_id, work_id, isbn_10, isbn_13, metadata')
          .in('provider', ['google_books', 'isbndb']).in(column, wanted);
        if (isbnError) throw new Error(`Could not read ISBN cover identities: ${isbnError.message}`);
        for (const edition of isbnEditions ?? []) {
          if (edition[column] && edition.work_id) {
            const key = `isbn:${edition[column]}`;
            const works = isbnCandidates.get(key) ?? new Set<string>();
            works.add(edition.work_id);
            isbnCandidates.set(key, works);
          }
          editionRows.push(edition);
        }
      }

      const workIds: string[] =
        Array.from(
          new Set(
            editionRows
              .map(
                (
                  edition
                ) =>
                  edition.work_id
              )
              .filter(
                (
                  value: unknown
                ): value is string =>
                  typeof value ===
                    'string' &&
                  Boolean(
                    value
                  )
              )
          )
        );

      const aliases = await catalogCoverAliases(supabaseAdmin, editionRows);
      // An ISBN collision must not choose an arbitrary author's work by row order.
      for (const [key, candidates] of isbnCandidates) {
        const ids = [...candidates].sort();
        if (ids.length === 1 || ids.every(id => aliases.get(ids[0])?.includes(id))) isbnWorkIds.set(key, ids[0]);
      }
      for (const ids of aliases.values()) for (const id of ids) if (!workIds.includes(id)) workIds.push(id);

      // Re-evaluate existing catalog candidates only. No provider requests or
      // cache invalidation; manual/locked selections remain protected.
      const rejectedByWork = new Map<string, string[]>();
      await selectCanonicalGoogleCoversForWorkIds(supabaseAdmin, workIds, (workId, url) => {
        const urls = rejectedByWork.get(workId) ?? [];
        if (!urls.includes(url)) urls.push(url);
        rejectedByWork.set(workId, urls);
      });

      const selectionsByWork =
        new Map<
          string,
          {
            candidate_id:
              string;
            selector_version:
              number;
            score:
              number | null;
            locked:
              boolean;
          }
        >();

      if (
        workIds.length >
        0
      ) {
        const {
          data:
            selections,
          error:
            selectionError,
        } =
          await supabaseAdmin
            .from(
              'book_cover_selections'
            )
            .select(
              'work_id, candidate_id, selector_version, status, score, locked'
            )
            .in(
              'work_id',
              workIds
            )
            .eq(
              'status',
              'selected'
            );

        if (selectionError) {
          throw new Error(
            `Could not read Novori cover selections: ${selectionError.message}`
          );
        }

        for (
          const selection of
            selections ??
            []
        ) {
          if (
            typeof selection.work_id ===
              'string' &&
            typeof selection.candidate_id ===
              'string'
          ) {
            selectionsByWork.set(
              selection.work_id,
              {
                candidate_id:
                  selection.candidate_id,
                selector_version:
                  selection.selector_version,
                score:
                  selection.score,
                locked:
                  selection.locked,
              }
            );
          }
        }
      }

      const candidateIds =
        Array.from(
          new Set(
            Array.from(
              selectionsByWork.values()
            ).map(
              (
                selection
              ) =>
                selection.candidate_id
            )
          )
        );

      const candidatesById =
        new Map<
          string,
          {
            url:
              string | null;
            provider:
              string | null;
            source_variant:
              string | null;
            scope:
              string | null;
          }
        >();

      if (
        candidateIds.length >
        0
      ) {
        const {
          data:
            candidates,
          error:
            candidateError,
        } =
          await supabaseAdmin
            .from(
              'book_cover_candidates'
            )
            .select(
              'id, url, provider, source_variant, scope'
            )
            .in(
              'id',
              candidateIds
            );

        if (candidateError) {
          throw new Error(
            `Could not read Novori cover candidates: ${candidateError.message}`
          );
        }

        for (
          const candidate of
            candidates ??
            []
        ) {
          if (
            typeof candidate.id ===
              'string'
          ) {
            candidatesById.set(
              candidate.id,
              {
                url:
                  typeof candidate.url ===
                    'string' &&
                  candidate.url.trim()
                    ? candidate.url
                        .replace(
                          'http://',
                          'https://'
                        )
                    : null,
                provider:
                  candidate.provider ??
                  null,
                source_variant:
                  candidate.source_variant ??
                  null,
                scope:
                  candidate.scope ??
                  null,
              }
            );
          }
        }
      }

      const covers:
        Record<
          string,
          string | null
        > = {};

      const details:
        Record<
          string,
          Record<
            string,
            unknown
          >
        > = {};

      const workByVolumeId =
        new Map<
          string,
          string
        >();

      for (
        const edition of
          editionRows
      ) {
        if (
          typeof edition.provider_book_id ===
            'string' &&
          typeof edition.work_id ===
            'string'
        ) {
          workByVolumeId.set(
            edition.provider_book_id,
            edition.work_id
          );
        }
      }

      // Some legacy/cached editions have publisher art but no candidate row.
      // Recover that art for all verified work aliases before returning a null.
      const missingWorks = workIds.filter(id => !selectionsByWork.get(id)?.locked && (!candidatesById.get(selectionsByWork.get(id)?.candidate_id ?? '')?.url || editionRows.some((row: any) => (aliases.get(row.work_id) ?? [row.work_id]).includes(id) && preferredCoverIsbn(row.metadata?.volumeInfo ?? {}))));
      const metadataEditions: any[] = [];
      for (let offset = 0; offset < missingWorks.length; offset += 100) {
        for (let page = 0; ; page += 1000) {
          const { data, error } = await supabaseAdmin.from('book_editions')
            .select('id,provider,provider_book_id,work_id,isbn_13,language,metadata')
            .in('provider', ['google_books', 'isbndb']).in('work_id', missingWorks.slice(offset, offset + 100))
            .order('id').range(page, page + 999);
          if (error) throw error;
          metadataEditions.push(...(data ?? []).filter((row: any) => editionRows.some((seed: any) =>
            (aliases.get(seed.work_id) ?? [seed.work_id]).includes(row.work_id) &&
            matchesSeriesCatalogEdition(seed.metadata?.volumeInfo ?? {}, row))));
          if ((data ?? []).length < 1000) break;
        }
      }
      const metadataCovers = cachedWorkCovers(metadataEditions);

      const requestKeys = [...volumeIds, ...requestedIsbns.map(isbn => `isbn:${isbn}`)];
      for (const volumeId of requestKeys) {
        const originalWorkId = workByVolumeId.get(volumeId) ?? isbnWorkIds.get(volumeId);
        // Keep an explicit manual selection on the requested work. Otherwise,
        // every verified alias uses the same deterministic stored winner.
        const eligible = originalWorkId ? aliases.get(originalWorkId) ?? [originalWorkId] : [];
        const ordered = eligible.filter(id => {
          const selected = selectionsByWork.get(id);
          return (selected && candidatesById.get(selected.candidate_id)?.url) || metadataCovers.has(id);
        }).sort((a, b) => Number(selectionsByWork.get(b)?.locked) - Number(selectionsByWork.get(a)?.locked) ||
          Math.max(selectionsByWork.get(b)?.score ?? 0, metadataCovers.get(b)?.score ?? 0) - Math.max(selectionsByWork.get(a)?.score ?? 0, metadataCovers.get(a)?.score ?? 0) || a.localeCompare(b));
        const workId = originalWorkId && selectionsByWork.get(originalWorkId)?.locked ? originalWorkId : ordered[0] ?? originalWorkId;

        const selection =
          workId
            ? selectionsByWork.get(
                workId
              )
            : undefined;

        const recovered = metadataCovers.get(workId);
        const candidate = recovered?.preferred && !selection?.locked ? recovered :
          (selection ? candidatesById.get(selection.candidate_id) : undefined) ?? recovered;

        const selectedUrl =
          candidate?.url ??
          null;

        covers[
          volumeId
        ] =
          selectedUrl;

        details[
          volumeId
        ] = {
          workId: workId ?? null,
          rejectedUrls: workId ? [...new Set(eligible.flatMap(id => rejectedByWork.get(id) ?? []))].filter(url => url !== selectedUrl) : [],
          selectionStatus:
            selectedUrl
              ? 'selected'
              : 'unavailable',
          selectorVersion:
            selection
              ?.selector_version ??
            null,
          score:
            selection
              ?.score ??
            null,
          locked:
            Boolean(
              selectedUrl &&
              selection
                ?.locked
            ),
          authoritative: Boolean(selectedUrl),
          url:
            selectedUrl,
          provider:
            candidate
              ?.provider ??
            null,
          sourceVariant:
            candidate
              ?.source_variant ??
            null,
          scope:
            candidate
              ?.scope ??
            null,
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
