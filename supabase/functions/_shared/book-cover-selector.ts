import { preferredCoverIsbn } from './catalog-cover-preferences.ts';
import { audioEditionPenalty, editionFormat, isCatalogCollection, isCatalogSupplement } from './book-edition-metadata.ts';
import { isEnglishBookLanguage } from './book-language.ts';
import type {
  SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

const SELECTOR_VERSION =
  6;

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
  source_metadata?: { coverEdition?: { version?: number; editionId?: number; language?: string; isbn?: string; url?: string; title?: string } };
};

type EditionRow = {
  isbn_13?: string | null;
  metadata?: { volumeInfo: any; novoriEdition?: { binding?: string; format?: string } };
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
  candidate_id?: string | null;
  selector_version?: number;
  status?: string;
  score?: number | null;
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

  const isEnglish = isEnglishBookLanguage(language);

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

  // Hardcover work artwork is not a publisher cover source. Keep it for
  // readership and series membership, never automatic artwork selection.
  if (candidate.provider === HARDCOVER_PROVIDER) return null;

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

  const preference = edition.metadata?.volumeInfo ? preferredCoverIsbn(edition.metadata.volumeInfo) : null;
  return (
    (preference && edition.isbn_13 === preference ? 1000 : 0) + qualityScore - (edition.metadata ? 250 * audioEditionPenalty(edition.metadata) : 0) +
    editionLocaleScore +
    (
      candidate.provider !== 'isbndb' && edition.detail_complete
        ? 20
        : 0
    )
  );
}

// ISBNdb slots often share one image; dates do not establish artwork quality.
function compareIsbnDbEditions(a: EditionRow, b: EditionRow) {
  const rank = (edition: EditionRow) => {
    const format = edition.metadata ? editionFormat(edition.metadata) : 'unknown';
    return format === 'print' ? 0 : format === 'ebook' ? 1 : 2;
  };
  return rank(a) - rank(b);
}

export async function selectCanonicalGoogleCoversForWorkIds(
  supabaseAdmin:
    SupabaseClient,
  workIds: string[],
  onRejected?: (workId: string, url: string) => void
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
          'work_id, locked, candidate_id, selector_version, status, score'
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

    // Read every stored candidate; a large library must not turn the database's
    // first-page limit into a cover downgrade for later works in the batch.
    const candidates: CandidateRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabaseAdmin
        .from('book_cover_candidates')
        .select('id, work_id, edition_id, provider, source_variant, url, source_metadata')
        .in('provider', [GOOGLE_PROVIDER, HARDCOVER_PROVIDER, 'isbndb'])
        .eq('scope', 'edition')
        .in('work_id', eligibleWorkIds)
        .order('id')
        .range(offset, offset + 999);
      if (error) {
        console.warn('Could not read Novori cover candidates:', error.message);
        return;
      }
      const page = (data ?? []) as CandidateRow[];
      candidates.push(...page);
      if (page.length < 1000) break;
    }

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
      // Keep IN filters short even when a work has many cached editions.
      for (let offset = 0; offset < editionIds.length; offset += 200) {
        const { data, error } = await supabaseAdmin
          .from('book_editions')
          .select('id, isbn_13, detail_complete, language, sale_country, metadata')
          .in('id', editionIds.slice(offset, offset + 200));
        if (error) {
          console.warn('Could not read editions for Novori cover selection:', error.message);
          return;
        }
        for (const edition of (data ?? []) as EditionRow[]) editionsById.set(edition.id, edition);
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

          const previous = (existingSelections ?? []).find(
            row => row.work_id === workId
          ) as ExistingSelectionRow | undefined;

          let ranked =
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

                  if (candidate.provider === HARDCOVER_PROVIDER) onRejected?.(workId, candidate.url);
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
                  a.candidate.provider.localeCompare(b.candidate.provider) ||
                  (a.candidate.provider === 'isbndb' && b.candidate.provider === 'isbndb'
                    ? compareIsbnDbEditions(a.edition, b.edition) : 0) ||
                  // Retain a still-eligible winner when quality and edition
                  // preference are equal. Discovering another UUID is not an upgrade.
                  Number(b.candidate.id === previous?.candidate_id) -
                    Number(a.candidate.id === previous?.candidate_id) ||
                  a.candidate.id.localeCompare(
                    b.candidate.id
                  )
              );

          // Old provider records may already share a work with a mislabeled set.
          // Do not borrow set/calendar artwork when normal book candidates exist.
          const isProductExtra = (item: typeof ranked[number]) => item.edition.metadata &&
            (isCatalogCollection(item.edition.metadata) || isCatalogSupplement(item.edition.metadata));
          if (ranked.some(item => !isProductExtra(item))) ranked = ranked.filter(item => !isProductExtra(item));
          // Stability must not pin an audiobook/narrator image when print art exists.
          const isAudio = (item: typeof ranked[number]) => Boolean(item.edition.metadata && audioEditionPenalty(item.edition.metadata));
          if (ranked.some(item => !isAudio(item))) ranked = ranked.filter(item => !isAudio(item));

          const strongRanked =
            ranked.filter(
              (
                candidate
              ) =>
                candidate.strong
            );

          // Ordinary reads and metadata enrichment must not switch eligible art.
          const retained = ranked.find(item => item.candidate.id === previous?.candidate_id);
          const preferred = ranked.find(item => {
            const isbn = item.edition.metadata?.volumeInfo ? preferredCoverIsbn(item.edition.metadata.volumeInfo) : null;
            return isbn && item.edition.isbn_13 === isbn;
          });
          const selected =
            preferred ?? retained ?? strongRanked[0] ??
            ranked[0] ??
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
                'isbndb',
              ],
              preferredMinimumGoogleVariant:
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
                'Preserve eligible catalog artwork and manual locks; exclude automatic Hardcover artwork; dates and metadata refreshes do not replace selected covers.',
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

    const changedDecisions = decisions.filter(decision => {
      const previous = (existingSelections ?? []).find(row => row.work_id === decision.work_id) as ExistingSelectionRow | undefined;
      return !previous || previous.candidate_id !== decision.candidate_id ||
        previous.status !== decision.status || previous.score !== decision.score ||
        previous.selector_version !== decision.selector_version;
    });
    if (!changedDecisions.length) return;

    const {
      error:
        selectionWriteError,
    } =
      await supabaseAdmin
        .from(
          'book_cover_selections'
        )
        .upsert(
          changedDecisions,
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
