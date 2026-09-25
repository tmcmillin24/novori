import { supabase } from './supabase';
import {
    getUserBook,
    UserBook,
} from './user-books';

export type ReadingSession = {
  id: string;
  user_id: string;
  user_book_id: string;
  session_number: number;
  summary_text: string | null;
  started_at: string | null;
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
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type ReadingDetailsData = {
  book: UserBook;
  session: ReadingSession;
  latest_checkpoint:
    | ReadingCheckpoint
    | null;
  checkpoints: ReadingCheckpoint[];
  notes: ReadingNote[];
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
};

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

  const [
    checkpointsResult,
    notesResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'reading_checkpoints'
        )
        .select('*')
        .eq(
          'user_id',
          user.id
        )
        .eq(
          'session_id',
          session.id
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
        .eq(
          'session_id',
          session.id
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
    ]);

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

  const checkpoints =
    (
      checkpointsResult.data ??
      []
    ).map(
      normalizeCheckpoint
    );

  const notes =
    (
      notesResult.data ??
      []
    ).map(
      normalizeNote
    );

  return {
    book,
    session,
    latest_checkpoint:
      checkpoints[0] ??
      null,
    checkpoints,
    notes,
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
