import { supabase } from './supabase';
import {
  getUserBook,
  notifyLibraryChanged,
  UserBook,
  UserBookStatus,
} from './user-books';

export type ReadingJourneyStatus =
  | 'active'
  | 'paused'
  | 'finished'
  | 'dnf';

export type ReadingJourneyAction =
  | 'start'
  | 'pause'
  | 'resume'
  | 'finish'
  | 'dnf';

export type ReadingSession = {
  id: string;
  user_id: string;
  user_book_id: string;
  session_number: number;
  summary_text: string | null;
  journey_status: ReadingJourneyStatus;
  started_at: string | null;
  paused_at: string | null;
  finished_at: string | null;
  dnf_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReadingCheckpoint = {
  id: string;
  user_id: string;
  session_id: string;
  page_number: number | null;
  progress_percent: number | null;
  chapter: string | null;
  checkpoint_note: string | null;
  created_at: string;
};

export type ReadingNote = {
  id: string;
  user_id: string;
  session_id: string;
  body: string;
  page_number: number | null;
  progress_percent: number | null;
  chapter: string | null;
  audio_position_seconds: number | null;
  is_pinned: boolean;
  source_type: 'reading_update' | null;
  source_post_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ReadingJourneyArchive = {
  session: ReadingSession;
  latest_checkpoint:
    | ReadingCheckpoint
    | null;
  checkpoints: ReadingCheckpoint[];
  notes: ReadingNote[];
};

export type ReadingDetailsData = {
  book: UserBook;
  session: ReadingSession;
  latest_checkpoint:
    | ReadingCheckpoint
    | null;
  checkpoints: ReadingCheckpoint[];
  notes: ReadingNote[];
  previous_journeys:
    ReadingJourneyArchive[];
};

type ProgressInput = {
  pageNumber?: number | null;
  progressPercent?: number | null;
  chapter?: string | null;
  note?: string | null;
};

type NoteInput = {
  body: string;
  pageNumber?: number | null;
  progressPercent?: number | null;
  chapter?: string | null;
  audioPositionSeconds?: number | null;
};

function validateAudioPosition(seconds: number | null | undefined) {
  if (
    seconds != null &&
    (!Number.isSafeInteger(seconds) || seconds < 0)
  ) {
    throw new Error('Enter an audio timestamp like 1:23:45 or 23:45.');
  }
}

async function requireUser() {
  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth
      .getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error(
      'You must be signed in.'
    );
  }

  return user;
}

function normalizeCheckpoint(
  row: any
): ReadingCheckpoint {
  return {
    ...row,
    page_number:
      row.page_number ===
        null
        ? null
        : Number(
            row.page_number
          ),
    progress_percent:
      row.progress_percent ===
        null
        ? null
        : Number(
            row.progress_percent
          ),
  } as ReadingCheckpoint;
}

function normalizeNote(
  row: any
): ReadingNote {
  return {
    ...row,
    page_number:
      row.page_number ===
        null
        ? null
        : Number(
            row.page_number
          ),
    progress_percent:
      row.progress_percent ===
        null
        ? null
        : Number(
            row.progress_percent
          ),
    audio_position_seconds:
      row.audio_position_seconds == null
        ? null
        : Number(row.audio_position_seconds),
    is_pinned:
      Boolean(
        row.is_pinned
      ),
  } as ReadingNote;
}

export async function ensureReadingSession(
  googleBookId: string
): Promise<ReadingSession> {
  await requireUser();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'ensure_reading_session',
      {
        target_google_book_id:
          googleBookId,
      }
    );

  if (error) {
    throw error;
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data;

  if (!row) {
    throw new Error(
      'Could not create reading details.'
    );
  }

  return row as ReadingSession;
}

export async function transitionReadingJourney(
  googleBookId: string,
  action: ReadingJourneyAction,
  occurredAt?: string | null
): Promise<ReadingSession> {
  await requireUser();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'transition_reading_journey',
      {
        target_google_book_id:
          googleBookId,
        target_action:
          action,
        target_occurred_at:
          occurredAt ??
          new Date()
            .toISOString(),
      }
    );

  if (error) {
    throw error;
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data;

  if (!row) {
    throw new Error(
      'Could not update this reading journey.'
    );
  }

  notifyLibraryChanged();

  return row as ReadingSession;
}

export async function getReadingDetails(
  googleBookId: string
): Promise<ReadingDetailsData> {
  const user =
    await requireUser();

  const book =
    await getUserBook(
      googleBookId
    );

  if (!book) {
    throw new Error(
      'This book is not in your library.'
    );
  }

  if (
    book.status ===
    'want_to_read'
  ) {
    throw new Error(
      'Reading Details become available when you start this book.'
    );
  }

  const session =
    await ensureReadingSession(
      googleBookId
    );

  const {
    data: sessionsData,
    error: sessionsError,
  } =
    await supabase
      .from(
        'reading_sessions'
      )
      .select('*')
      .eq(
        'user_id',
        user.id
      )
      .eq(
        'user_book_id',
        book.id
      )
      .order(
        'session_number',
        {
          ascending:
            false,
        }
      );

  if (sessionsError) {
    throw sessionsError;
  }

  const sessions =
    (
      sessionsData ??
      []
    ) as ReadingSession[];

  const sessionIds =
    sessions.map(
      (
        item
      ) =>
        item.id
    );

  const [
    checkpointsResult,
    notesResult,
  ] =
    sessionIds.length >
    0
      ? await Promise.all([
          supabase
            .from(
              'reading_checkpoints'
            )
            .select('*')
            .eq(
              'user_id',
              user.id
            )
            .in(
              'session_id',
              sessionIds
            )
            .order(
              'created_at',
              {
                ascending:
                  false,
              }
            ),
          supabase
            .from(
              'reading_notes'
            )
            .select('*')
            .eq(
              'user_id',
              user.id
            )
            .in(
              'session_id',
              sessionIds
            )
            .order(
              'is_pinned',
              {
                ascending:
                  false,
              }
            )
            .order(
              'created_at',
              {
                ascending:
                  false,
              }
            ),
        ])
      : [
          {
            data: [],
            error: null,
          },
          {
            data: [],
            error: null,
          },
        ];

  if (
    checkpointsResult.error
  ) {
    throw checkpointsResult.error;
  }

  if (
    notesResult.error
  ) {
    throw notesResult.error;
  }

  const allCheckpoints =
    (
      checkpointsResult.data ??
      []
    ).map(
      normalizeCheckpoint
    );

  const allNotes =
    (
      notesResult.data ??
      []
    ).map(
      normalizeNote
    );

  const checkpoints =
    allCheckpoints.filter(
      (
        checkpoint
      ) =>
        checkpoint.session_id ===
        session.id
    );

  const notes =
    allNotes.filter(
      (
        note
      ) =>
        note.session_id ===
        session.id
    );

  const previous_journeys =
    sessions
      .filter(
        (
          item
        ) =>
          item.id !==
          session.id
      )
      .map(
        (
          archivedSession
        ): ReadingJourneyArchive => {
          const archivedCheckpoints =
            allCheckpoints.filter(
              (
                checkpoint
              ) =>
                checkpoint.session_id ===
                archivedSession.id
            );

          const archivedNotes =
            allNotes.filter(
              (
                note
              ) =>
                note.session_id ===
                archivedSession.id
            );

          return {
            session:
              archivedSession,
            latest_checkpoint:
              archivedCheckpoints[0] ??
              null,
            checkpoints:
              archivedCheckpoints,
            notes:
              archivedNotes,
          };
        }
      );

  return {
    book,
    session,
    latest_checkpoint:
      checkpoints[0] ??
      null,
    checkpoints,
    notes,
    previous_journeys,
  };
}

export async function saveReadingCheckpoint(
  sessionId: string,
  input: ProgressInput
): Promise<ReadingCheckpoint> {
  const user =
    await requireUser();

  const pageNumber =
    input.pageNumber ??
    null;

  const progressPercent =
    input.progressPercent ??
    null;

  const chapter =
    input.chapter
      ?.trim() ||
    null;

  const note =
    input.note
      ?.trim() ||
    null;

  if (
    pageNumber === null &&
    progressPercent === null &&
    chapter === null
  ) {
    throw new Error(
      'Add a page, percentage, or chapter before saving.'
    );
  }

  if (
    pageNumber !== null &&
    (
      !Number.isInteger(
        pageNumber
      ) ||
      pageNumber < 1
    )
  ) {
    throw new Error(
      'Page number must be a whole number greater than 0.'
    );
  }

  if (
    progressPercent !==
      null &&
    (
      progressPercent < 0 ||
      progressPercent > 100
    )
  ) {
    throw new Error(
      'Percentage must be between 0 and 100.'
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'reading_checkpoints'
      )
      .insert({
        user_id:
          user.id,
        session_id:
          sessionId,
        page_number:
          pageNumber,
        progress_percent:
          progressPercent,
        chapter,
        checkpoint_note:
          note,
      })
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return normalizeCheckpoint(
    data
  );
}

export async function saveReadingSummary(
  sessionId: string,
  summary: string
): Promise<ReadingSession> {
  const user =
    await requireUser();

  const cleaned =
    summary.trim();

  if (
    cleaned.length >
    10000
  ) {
    throw new Error(
      'Your summary is too long.'
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'reading_sessions'
      )
      .update({
        summary_text:
          cleaned ||
          null,
        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return data as ReadingSession;
}

export async function addReadingNote(
  sessionId: string,
  input: NoteInput
): Promise<ReadingNote> {
  const user =
    await requireUser();

  const body =
    input.body.trim();

  validateAudioPosition(input.audioPositionSeconds);

  if (!body) {
    throw new Error(
      'Write something before saving your note.'
    );
  }

  if (
    body.length >
    5000
  ) {
    throw new Error(
      'Notes can be up to 5,000 characters.'
    );
  }

  const pageNumber =
    input.pageNumber ??
    null;

  const progressPercent =
    input.progressPercent ??
    null;

  if (
    pageNumber !== null &&
    (
      !Number.isInteger(
        pageNumber
      ) ||
      pageNumber < 1
    )
  ) {
    throw new Error(
      'Page number must be a whole number greater than 0.'
    );
  }

  if (
    progressPercent !==
      null &&
    (
      progressPercent < 0 ||
      progressPercent > 100
    )
  ) {
    throw new Error(
      'Percentage must be between 0 and 100.'
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'reading_notes'
      )
      .insert({
        user_id:
          user.id,
        session_id:
          sessionId,
        body,
        page_number:
          pageNumber,
        progress_percent:
          progressPercent,
        chapter:
          input.chapter
            ?.trim() ||
          null,
        audio_position_seconds:
          input.audioPositionSeconds ?? null,
      })
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return normalizeNote(
    data
  );
}


export async function updateReadingNote(
  noteId: string,
  sessionId: string,
  input: NoteInput
): Promise<ReadingNote> {
  const user = await requireUser();

  const body =
    input.body.trim();

  validateAudioPosition(input.audioPositionSeconds);

  if (!body) {
    throw new Error(
      'Write something before saving your note.'
    );
  }

  if (
    body.length >
    5000
  ) {
    throw new Error(
      'Notes can be up to 5,000 characters.'
    );
  }

  const pageNumber =
    input.pageNumber ??
    null;

  const progressPercent =
    input.progressPercent ??
    null;

  if (
    pageNumber !== null &&
    (
      !Number.isInteger(
        pageNumber
      ) ||
      pageNumber < 1
    )
  ) {
    throw new Error(
      'Page number must be a whole number greater than 0.'
    );
  }

  if (
    progressPercent !==
      null &&
    (
      progressPercent < 0 ||
      progressPercent > 100
    )
  ) {
    throw new Error(
      'Percentage must be between 0 and 100.'
    );
  }

  const { data, error } = await supabase
    .from('reading_notes')
    .update({
      body,
      page_number: pageNumber,
      progress_percent: progressPercent,
      chapter: input.chapter?.trim() || null,
      audio_position_seconds: input.audioPositionSeconds ?? null,
    })
    .eq('id', noteId)
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data;

  if (!row) {
    throw new Error(
      'Could not update this note.'
    );
  }

  return normalizeNote(
    row
  );
}

export async function deleteReadingNote(
  noteId: string,
  sessionId: string
): Promise<string> {
  const user =
    await requireUser();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'reading_notes'
      )
      .delete()
      .eq(
        'id',
        noteId
      )
      .eq(
        'session_id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )
      .select('id')
      .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function deleteReadingCheckpoint(
  checkpointId: string,
  sessionId: string
): Promise<string> {
  await requireUser();

  const { data, error } = await supabase.rpc(
    'delete_reading_checkpoint',
    {
      target_checkpoint_id: checkpointId,
      target_session_id: sessionId,
    }
  );

  if (error) {
    throw error;
  }

  return String(data);
}


export async function updateReadingDetailsDates(
  sessionId: string,
  googleBookId: string,
  status: UserBookStatus,
  startedAt: string | null,
  finishedAt: string | null,
  dnfAt: string | null
): Promise<UserBook> {
  await requireUser();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'update_reading_journey_dates',
      {
        target_session_id:
          sessionId,
        target_started_at:
          startedAt,
        target_finished_at:
          status ===
          'read'
            ? finishedAt
            : null,
        target_dnf_at:
          status ===
          'dnf'
            ? dnfAt
            : null,
      }
    );

  if (error) {
    throw error;
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data;

  if (!row) {
    throw new Error(
      'Could not update these reading dates.'
    );
  }

  notifyLibraryChanged();

  return row as UserBook;
}
