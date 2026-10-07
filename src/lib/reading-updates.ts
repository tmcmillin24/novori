import { supabase } from './supabase';
import {
  markPostMutation,
} from './feed';
import {
  ensureDailyReadingCheckin,
} from './reading-checkins';

type PublishReadingUpdateInput = {
  googleBookId: string;
  containsSpoilers?: boolean;
  clubId?: string | null;
  progress?: string;
  chapter?: string;
  thought?: string;
  audioPosition?: string;
  sourceNoteId?: string | null;
};

function parseAudioPosition(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(':');
  if ((parts.length !== 2 && parts.length !== 3) ||
      parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error('Enter an audiobook time like 23:45 or 1:23:45.');
  }
  const values = parts.map(Number);
  const seconds = values[values.length - 1];
  const minutes = values[values.length - 2];
  const hours = parts.length === 3 ? values[0] : 0;
  if (seconds > 59 || (parts.length === 3 && minutes > 59)) {
    throw new Error('Minutes and seconds must be below 60.');
  }
  const total = hours * 3600 + minutes * 60 + seconds;
  if (!Number.isSafeInteger(total) || total > 2147483647) {
    throw new Error('Audiobook time is too long.');
  }
  return total;
}

function formatAudioPosition(total: number): string {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

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

  const audioSeconds = parseAudioPosition(input.audioPosition ?? '');
  if (audioSeconds !== null) {
    parts.push(`Audio ${formatAudioPosition(audioSeconds)}`);
  }

  const thought =
    input.thought
      ?.trim() ||
    '';

  const progressLine =
    parts.join(
      ' \u00b7 '
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

  const audioSeconds = parseAudioPosition(input.audioPosition ?? '');

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
    audioSeconds === null &&
    !thought
  ) {
    throw new Error(
      'Add a page, percentage, chapter, audio time, or thought before publishing.'
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

  const rpcInput = {
    target_google_book_id: input.googleBookId,
    post_body: body,
    checkpoint_page_number: parsed.pageNumber,
    checkpoint_progress_percent: parsed.progressPercent,
    checkpoint_chapter: chapter,
    checkpoint_audio_position_seconds: audioSeconds,
    private_note_body: thought || null,
    source_note_id: thought ? input.sourceNoteId?.trim() || null : null,
  };
  const { data, error } = await supabase.rpc('novori_publish_reading_update', {
    p_input: {...rpcInput, target_club_id: input.clubId ?? null},
    p_spoilers: input.containsSpoilers === true,
  });
  if (error) throw error;

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

  try {
    await ensureDailyReadingCheckin(
      [
        input.googleBookId,
      ],
      'reading_update'
    );
  } catch (
    checkinError
  ) {
    console.warn(
      'Reading Update published, but daily check-in could not be recorded:',
      checkinError
    );
  }

  return String(
    postId
  );
}

export async function updateReadingUpdate(
  postId: string,
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

  const audioSeconds = parseAudioPosition(input.audioPosition ?? '');

  if (
    !postId.trim()
  ) {
    throw new Error(
      'This Reading Update is unavailable.'
    );
  }

  if (
    !input.googleBookId
      .trim()
  ) {
    throw new Error(
      'This Reading Update is missing its book.'
    );
  }

  if (
    parsed.pageNumber ===
      null &&
    parsed.progressPercent ===
      null &&
    chapter ===
      null &&
    audioSeconds === null &&
    !thought
  ) {
    throw new Error(
      'Add a page, percentage, chapter, audio time, or thought before saving.'
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
    data: {
      user,
    },
    error:
      authError,
  } =
    await supabase.auth.getUser();

  if (
    authError
  ) {
    throw authError;
  }

  if (
    !user
  ) {
    throw new Error(
      'You must be signed in.'
    );
  }

  if (input.clubId) {
    const { data: membership, error: membershipError } = await supabase.from('club_members')
      .select('club_id').eq('club_id', input.clubId).eq('user_id', user.id).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) throw new Error('Join this club before posting a Reading Update there.');
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'posts'
      )
      .update({
        body,
        contains_spoilers: input.containsSpoilers === true,
        ...('clubId' in input ? { club_id: input.clubId ?? null } : {}),
        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'id',
        postId
      )
      .eq(
        'author_id',
        user.id
      )
      .eq(
        'post_type',
        'reading_update'
      )
      .eq(
        'google_book_id',
        input.googleBookId
      )
      .select(
        'id'
      )
      .single();

  if (
    error
  ) {
    throw error;
  }

  if (
    !data?.id
  ) {
    throw new Error(
      'Could not update this Reading Update.'
    );
  }

  markPostMutation();

  return data.id as string;
}
