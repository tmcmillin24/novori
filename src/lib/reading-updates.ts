import { supabase } from './supabase';

type PublishReadingUpdateInput = {
  googleBookId: string;
  progress?: string;
  chapter?: string;
  thought?: string;
};

type ParsedProgress = {
  pageNumber: number | null;
  progressPercent: number | null;
};

function parseProgress(
  value: string
): ParsedProgress {
  const cleaned =
    value.trim();

  if (!cleaned) {
    return {
      pageNumber: null,
      progressPercent: null,
    };
  }

  if (
    cleaned.endsWith(
      '%'
    )
  ) {
    const numeric =
      Number(
        cleaned.slice(
          0,
          -1
        ).trim()
      );

    if (
      !Number.isFinite(
        numeric
      ) ||
      numeric < 0 ||
      numeric > 100
    ) {
      throw new Error(
        'Percentage must be between 0 and 100.'
      );
    }

    return {
      pageNumber: null,
      progressPercent:
        numeric,
    };
  }

  if (
    !/^\d+$/.test(
      cleaned
    )
  ) {
    throw new Error(
      'Enter a page number like 245, or a percentage like 63%.'
    );
  }

  const pageNumber =
    Number(
      cleaned
    );

  if (
    !Number.isInteger(
      pageNumber
    ) ||
    pageNumber < 1
  ) {
    throw new Error(
      'Page number must be a whole number greater than 0.'
    );
  }

  return {
    pageNumber,
    progressPercent: null,
  };
}

function buildPostBody(
  input: PublishReadingUpdateInput,
  parsed: ParsedProgress
) {
  const parts:
    string[] =
    [];

  if (
    parsed.pageNumber !==
    null
  ) {
    parts.push(
      `Page ${parsed.pageNumber}`
    );
  }

  if (
    parsed.progressPercent !==
    null
  ) {
    parts.push(
      `${parsed.progressPercent}%`
    );
  }

  const chapter =
    input.chapter
      ?.trim() ||
    '';

  if (chapter) {
    parts.push(
      `Chapter ${chapter}`
    );
  }

  const thought =
    input.thought
      ?.trim() ||
    '';

  const progressLine =
    parts.join(
      ' · '
    );

  if (
    progressLine &&
    thought
  ) {
    return `${progressLine}\n\n${thought}`;
  }

  return (
    progressLine ||
    thought
  );
}

export async function publishReadingUpdate(
  input: PublishReadingUpdateInput
): Promise<string> {
  const parsed =
    parseProgress(
      input.progress ??
        ''
    );

  const chapter =
    input.chapter
      ?.trim() ||
    null;

  const thought =
    input.thought
      ?.trim() ||
    '';

  if (
    !input.googleBookId
      .trim()
  ) {
    throw new Error(
      'Choose a book before publishing.'
    );
  }

  if (
    parsed.pageNumber ===
      null &&
    parsed.progressPercent ===
      null &&
    chapter ===
      null &&
    !thought
  ) {
    throw new Error(
      'Add a page, percentage, chapter, or thought before publishing.'
    );
  }

  if (
    chapter &&
    chapter.length >
      200
  ) {
    throw new Error(
      'Chapter can be up to 200 characters.'
    );
  }

  if (
    thought.length >
    500
  ) {
    throw new Error(
      'Your reading update can be up to 500 characters.'
    );
  }

  const body =
    buildPostBody(
      input,
      parsed
    );

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'publish_reading_update',
      {
        target_google_book_id:
          input.googleBookId,
        post_body:
          body,
        checkpoint_page_number:
          parsed.pageNumber,
        checkpoint_progress_percent:
          parsed.progressPercent,
        checkpoint_chapter:
          chapter,
      }
    );

  if (error) {
    throw error;
  }

  const postId =
    typeof data ===
      'string'
      ? data
      : Array.isArray(
          data
        )
      ? data[0]
      : data;

  if (!postId) {
    throw new Error(
      'The update was not published.'
    );
  }

  return String(
    postId
  );
}
