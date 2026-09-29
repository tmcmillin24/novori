import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

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
        Deno.env.get(
          'SUPABASE_SERVICE_ROLE_KEY'
        );

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

      const volumeId =
        typeof body?.volumeId ===
          'string'
          ? body.volumeId
              .trim()
          : '';

      if (
        !volumeId ||
        volumeId.length >
          200 ||
        !/^[A-Za-z0-9_-]+$/.test(
          volumeId
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            status: 400,
            error:
              'Invalid Google Books volume ID.',
          }
        );
      }

      const {
        data:
          edition,
        error:
          editionError,
      } =
        await supabaseAdmin
          .from(
            'book_editions'
          )
          .select(
            'work_id'
          )
          .eq(
            'provider',
            'google_books'
          )
          .eq(
            'provider_book_id',
            volumeId
          )
          .maybeSingle();

      if (editionError) {
        throw new Error(
          `Could not read Novori edition: ${editionError.message}`
        );
      }

      if (
        !edition?.work_id
      ) {
        return jsonResponse(
          {
            ok: true,
            status: 200,
            data: {
              selectionStatus:
                'unavailable',
              url:
                null,
            },
          }
        );
      }

      const {
        data:
          selection,
        error:
          selectionError,
      } =
        await supabaseAdmin
          .from(
            'book_cover_selections'
          )
          .select(
            'candidate_id, selector_version, status, score, locked'
          )
          .eq(
            'work_id',
            edition.work_id
          )
          .maybeSingle();

      if (selectionError) {
        throw new Error(
          `Could not read Novori cover selection: ${selectionError.message}`
        );
      }

      if (
        !selection ||
        selection.status !==
          'selected' ||
        !selection.candidate_id
      ) {
        return jsonResponse(
          {
            ok: true,
            status: 200,
            data: {
              selectionStatus:
                selection?.status ??
                'unavailable',
              selectorVersion:
                selection
                  ?.selector_version ??
                null,
              score:
                selection?.score ??
                null,
              locked:
                selection?.locked ??
                false,
              url:
                null,
            },
          }
        );
      }

      const {
        data:
          candidate,
        error:
          candidateError,
      } =
        await supabaseAdmin
          .from(
            'book_cover_candidates'
          )
          .select(
            'url, provider, source_variant, scope'
          )
          .eq(
            'id',
            selection.candidate_id
          )
          .maybeSingle();

      if (candidateError) {
        throw new Error(
          `Could not read Novori cover candidate: ${candidateError.message}`
        );
      }

      const selectedUrl =
        typeof candidate?.url ===
          'string' &&
        candidate.url.trim()
          ? candidate.url
              .replace(
                'http://',
                'https://'
              )
          : null;

      return jsonResponse(
        {
          ok: true,
          status: 200,
          data: {
            selectionStatus:
              selectedUrl
                ? 'selected'
                : 'unavailable',
            selectorVersion:
              selection
                .selector_version,
            score:
              selection.score,
            locked:
              selection.locked,
            url:
              selectedUrl,
            provider:
              candidate?.provider ??
              null,
            sourceVariant:
              candidate
                ?.source_variant ??
              null,
            scope:
              candidate?.scope ??
              null,
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
