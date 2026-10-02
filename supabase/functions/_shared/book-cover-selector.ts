import type {
  SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

const SELECTOR_VERSION =
  1;

const GOOGLE_PROVIDER =
  'google_books';

const HARDCOVER_PROVIDER =
  'hardcover';

const STRONG_VARIANTS =
  new Set([
    'medium',
    'large',
    'extraLarge',
  ]);

const VARIANT_SCORE:
  Record<
    string,
    number
  > = {
    extraLarge:
      600,
    large:
      500,
    medium:
      400,
    small:
      300,
    thumbnail:
      200,
    smallThumbnail:
      100,
  };

type CandidateRow = {
  id: string;
  work_id: string;
  edition_id:
    string | null;
  provider: string;
  source_variant:
    string | null;
  url: string;
};

type EditionRow = {
  id: string;
  detail_complete:
    boolean;
  language:
    string | null;
  sale_country:
    string | null;
};

type ExistingSelectionRow = {
  work_id: string;
  locked: boolean;
};

function normalizedLanguage(
  value:
    string | null
) {
  return (
    value ??
    ''
  )
    .trim()
    .toLowerCase();
}

function normalizedCountry(
  value:
    string | null
) {
  return (
    value ??
    ''
  )
    .trim()
    .toUpperCase();
}

function localeScore(
  edition:
    EditionRow
) {
  const language =
    normalizedLanguage(
      edition.language
    );

  const country =
    normalizedCountry(
      edition.sale_country
    );

  const isEnglish =
    language ===
      'en' ||
    language ===
      'eng' ||
    language.startsWith(
      'en-'
    );

  const isExplicitlyNonEnglish =
    Boolean(
      language
    ) &&
    !isEnglish;

  if (
    isExplicitlyNonEnglish
  ) {
    return null;
  }

  if (
    isEnglish &&
    country ===
      'US'
  ) {
    return 80;
  }

  if (
    isEnglish
  ) {
    return 60;
  }

  if (
    !language &&
    country ===
      'US'
  ) {
    return 40;
  }

  return null;
}

function candidateScore(
  candidate:
    CandidateRow,
  edition:
    EditionRow
) {
  const variant =
    candidate
      .source_variant ??
    '';

  const isVerifiedHardcoverSeries =
    candidate.provider ===
      HARDCOVER_PROVIDER &&
    variant ===
      'series_verified';

  if (
    isVerifiedHardcoverSeries
  ) {
    // Verified Hardcover series artwork is trusted ahead of
    // Google large/medium renditions for the same work, while
    // Google extraLarge remains the highest-priority automatic
    // source. Google large can score as high as 600 after locale
    // and detail bonuses; the lowest eligible extraLarge is 640.
    return 620;
  }

  const qualityScore =
    VARIANT_SCORE[
      variant
    ] ??
    0;

  const editionLocaleScore =
    localeScore(
      edition
    );

  if (
    editionLocaleScore ===
      null
  ) {
    return null;
  }

  return (
    qualityScore +
    editionLocaleScore +
    (
      edition.detail_complete
        ? 20
        : 0
    )
  );
}

export async function selectCanonicalGoogleCoversForWorkIds(
  supabaseAdmin:
    SupabaseClient,
  workIds: string[]
) {
  try {
    const uniqueWorkIds =
      Array.from(
        new Set(
          workIds.filter(
            Boolean
          )
        )
      );

    if (
      uniqueWorkIds.length ===
        0
    ) {
      return;
    }

    const {
      data:
        existingSelections,
      error:
        selectionReadError,
    } =
      await supabaseAdmin
        .from(
          'book_cover_selections'
        )
        .select(
          'work_id, locked'
        )
        .in(
          'work_id',
          uniqueWorkIds
        );

    if (
      selectionReadError
    ) {
      console.warn(
        'Could not read Novori cover selections:',
        selectionReadError.message
      );
      return;
    }

    const lockedWorkIds =
      new Set(
        (
          existingSelections ??
          []
        )
          .filter(
            (
              row
            ) =>
              (
                row as
                  ExistingSelectionRow
              ).locked ===
                true
          )
          .map(
            (
              row
            ) =>
              (
                row as
                  ExistingSelectionRow
              ).work_id
          )
      );

    const eligibleWorkIds =
      uniqueWorkIds.filter(
        (
          workId
        ) =>
          !lockedWorkIds.has(
            workId
          )
      );

    if (
      eligibleWorkIds.length ===
        0
    ) {
      return;
    }

    const {
      data:
        candidateRows,
      error:
        candidateReadError,
    } =
      await supabaseAdmin
        .from(
          'book_cover_candidates'
        )
        .select(
          'id, work_id, edition_id, provider, source_variant, url'
        )
        .in(
          'provider',
          [
            GOOGLE_PROVIDER,
            HARDCOVER_PROVIDER,
          ]
        )
        .eq(
          'scope',
          'edition'
        )
        .in(
          'work_id',
          eligibleWorkIds
        );

    if (
      candidateReadError
    ) {
      console.warn(
        'Could not read Novori cover candidates:',
        candidateReadError.message
      );
      return;
    }

    const candidates =
      (
        candidateRows ??
        []
      ) as CandidateRow[];

    const editionIds =
      Array.from(
        new Set(
          candidates
            .map(
              (
                candidate
              ) =>
                candidate.edition_id
            )
            .filter(
              (
                editionId
              ): editionId is string =>
                Boolean(
                  editionId
                )
            )
        )
      );

    const editionsById =
      new Map<
        string,
        EditionRow
      >();

    if (
      editionIds.length >
        0
    ) {
      const {
        data:
          editionRows,
        error:
          editionReadError,
      } =
        await supabaseAdmin
          .from(
            'book_editions'
          )
          .select(
            'id, detail_complete, language, sale_country'
          )
          .in(
            'id',
            editionIds
          );

      if (
        editionReadError
      ) {
        console.warn(
          'Could not read editions for Novori cover selection:',
          editionReadError.message
        );
        return;
      }

      for (
        const row of
          editionRows ??
          []
      ) {
        const edition =
          row as
            EditionRow;

        editionsById.set(
          edition.id,
          edition
        );
      }
    }

    const candidatesByWork =
      new Map<
        string,
        CandidateRow[]
      >();

    for (
      const candidate of
        candidates
    ) {
      const existing =
        candidatesByWork.get(
          candidate.work_id
        ) ??
        [];

      existing.push(
        candidate
      );

      candidatesByWork.set(
        candidate.work_id,
        existing
      );
    }

    const now =
      new Date()
        .toISOString();

    const decisions =
      eligibleWorkIds.map(
        (
          workId
        ) => {
          const workCandidates =
            candidatesByWork.get(
              workId
            ) ??
            [];

          const ranked =
            workCandidates
              .map(
                (
                  candidate
                ) => {
                  if (
                    !candidate
                      .edition_id
                  ) {
                    return null;
                  }

                  const edition =
                    editionsById.get(
                      candidate
                        .edition_id
                    );

                  if (
                    !edition
                  ) {
                    return null;
                  }

                  const score =
                    candidateScore(
                      candidate,
                      edition
                    );

                  if (
                    score ===
                      null
                  ) {
                    return null;
                  }

                  return {
                    candidate,
                    edition,
                    score,
                    strong:
                      (
                        candidate.provider ===
                          HARDCOVER_PROVIDER &&
                        candidate
                          .source_variant ===
                          'series_verified'
                      ) ||
                      STRONG_VARIANTS.has(
                        candidate
                          .source_variant ??
                          ''
                      ),
                  };
                }
              )
              .filter(
                (
                  candidate
                ): candidate is NonNullable<
                  typeof candidate
                > =>
                  Boolean(
                    candidate
                  )
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  b.score -
                    a.score ||
                  a.candidate.id.localeCompare(
                    b.candidate.id
                  )
              );

          const strongRanked =
            ranked.filter(
              (
                candidate
              ) =>
                candidate.strong
            );

          const selected =
            strongRanked[0] ??
            null;

          const status =
            selected
              ? 'selected'
              : ranked.length >
                  0
                ? 'insufficient_quality'
                : workCandidates.length >
                    0
                  ? 'ineligible'
                  : 'no_candidates';

          return {
            work_id:
              workId,
            candidate_id:
              selected
                ?.candidate
                .id ??
              null,
            selector_version:
              SELECTOR_VERSION,
            status,
            score:
              selected
                ?.score ??
              null,
            decision_json: {
              mode:
                'canonical',
              providers: [
                GOOGLE_PROVIDER,
                HARDCOVER_PROVIDER,
              ],
              requiredMinimumGoogleVariant:
                'medium',
              totalCandidates:
                workCandidates.length,
              eligibleCandidates:
                ranked.length,
              strongCandidates:
                strongRanked.length,
              selectedProvider:
                selected
                  ?.candidate
                  .provider ??
                null,
              selectedVariant:
                selected
                  ?.candidate
                  .source_variant ??
                null,
              selectedEditionDetailComplete:
                selected
                  ?.edition
                  .detail_complete ??
                null,
              rule:
                'Use verified Hardcover series artwork ahead of weaker Google candidates, while preserving Google extraLarge and all locked selections.',
            },
            selected_at:
              selected
                ? now
                : null,
            evaluated_at:
              now,
            updated_at:
              now,
          };
        }
      );

    if (
      decisions.length ===
        0
    ) {
      return;
    }

    const {
      error:
        selectionWriteError,
    } =
      await supabaseAdmin
        .from(
          'book_cover_selections'
        )
        .upsert(
          decisions,
          {
            onConflict:
              'work_id',
          }
        );

    if (
      selectionWriteError
    ) {
      console.warn(
        'Could not update Novori cover selections:',
        selectionWriteError.message
      );
    }
  } catch (
    error
  ) {
    console.warn(
      'Novori cover selection failed:',
      error
    );
  }
}
