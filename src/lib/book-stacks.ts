import {
  GoogleBookSearchItem,
  getBestSearchCover,
} from './book-search';
import { supabase } from './supabase';

export type BookStackVisibility =
  | 'profile';

export type BookStackItem = {
  id: string;
  stack_id: string;
  google_book_id: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  position: number;
  created_at: string;
};

export type BookStack = {
  id: string;
  user_id: string;
  name: string;
  visibility: BookStackVisibility;
  created_at: string;
  updated_at: string;
  items: BookStackItem[];
};

export type BookStackDraftItem = {
  googleBookId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
};

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } =
    await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error(
      'You must be signed in to manage Book Stacks.'
    );
  }

  return user.id;
}

function normalizeItems(
  rows: any[]
): BookStackItem[] {
  return rows
    .map((row) => ({
      id:
        String(row.id),
      stack_id:
        String(row.stack_id),
      google_book_id:
        String(row.google_book_id),
      title:
        String(row.title),
      authors:
        Array.isArray(row.authors)
          ? row.authors.filter(
              (
                author
              ): author is string =>
                typeof author ===
                'string'
            )
          : [],
      cover_url:
        typeof row.cover_url ===
        'string'
          ? row.cover_url
          : null,
      position:
        Number(
          row.position ?? 0
        ),
      created_at:
        String(
          row.created_at ?? ''
        ),
    }))
    .sort(
      (a, b) =>
        a.position -
        b.position
    );
}

async function attachItems(
  stacks: Omit<
    BookStack,
    'items'
  >[]
): Promise<BookStack[]> {
  if (
    stacks.length ===
    0
  ) {
    return [];
  }

  const stackIds =
    stacks.map(
      (stack) =>
        stack.id
    );

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'book_stack_items'
      )
      .select(
        'id, stack_id, google_book_id, title, authors, cover_url, position, created_at'
      )
      .in(
        'stack_id',
        stackIds
      )
      .order(
        'position',
        {
          ascending: true,
        }
      );

  if (error) {
    throw error;
  }

  const byStack =
    new Map<
      string,
      BookStackItem[]
    >();

  for (
    const item of
      normalizeItems(
        data ?? []
      )
  ) {
    const current =
      byStack.get(
        item.stack_id
      ) ?? [];

    current.push(
      item
    );

    byStack.set(
      item.stack_id,
      current
    );
  }

  return stacks.map(
    (stack) => ({
      ...stack,
      items:
        byStack.get(
          stack.id
        ) ?? [],
    })
  );
}

export function bookSearchItemToStackItem(
  book: GoogleBookSearchItem
): BookStackDraftItem {
  return {
    googleBookId:
      book.id,
    title:
      book.volumeInfo.title?.trim() ||
      'Untitled',
    authors:
      book.volumeInfo.authors ?? [],
    coverUrl:
      getBestSearchCover(
        book.volumeInfo.imageLinks
      ) ?? null,
  };
}

export async function saveBookStackSubmission({ name, items, stackId = null, publish = false, body = '', clubId = null, postId = null }: {
  name: string; items: BookStackDraftItem[]; stackId?: string | null; publish?: boolean;
  body?: string; clubId?: string | null; postId?: string | null;
}): Promise<BookStack> {
  const { data, error } = await supabase.rpc('novori_save_book_stack', {
    p_name: name.trim(), p_items: items, p_stack_id: stackId,
    p_publish: publish, p_body: body.trim(), p_club_id: clubId, p_post_id: postId,
  });
  if (error) throw error;
  return { ...data, items: normalizeItems(data.items ?? []) } as BookStack;
}

export async function createBookStack(name: string, items: BookStackDraftItem[]): Promise<BookStack> {
  return saveBookStackSubmission({ name, items });
}

export async function getMyBookStacks():
Promise<BookStack[]> {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'book_stacks'
      )
      .select(
        'id, user_id, name, visibility, created_at, updated_at'
      )
      .eq(
        'user_id',
        userId
      )
      .order(
        'updated_at',
        {
          ascending: false,
        }
      );

  if (error) {
    throw error;
  }

  return attachItems(
    (
      data ?? []
    ) as Omit<
      BookStack,
      'items'
    >[]
  );
}

export async function getPublicBookStacks(
  userId: string
): Promise<BookStack[]> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'book_stacks'
      )
      .select(
        'id, user_id, name, visibility, created_at, updated_at'
      )
      .eq(
        'user_id',
        userId
      )
      .eq(
        'visibility',
        'profile'
      )
      .order(
        'updated_at',
        {
          ascending: false,
        }
      );

  if (error) {
    throw error;
  }

  return attachItems(
    (
      data ?? []
    ) as Omit<
      BookStack,
      'items'
    >[]
  );
}

export async function getBookStack(
  stackId: string
): Promise<BookStack> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'book_stacks'
      )
      .select(
        'id, user_id, name, visibility, created_at, updated_at'
      )
      .eq(
        'id',
        stackId
      )
      .single();

  if (error) {
    throw error;
  }

  const [stack] =
    await attachItems([
      data as Omit<
        BookStack,
        'items'
      >,
    ]);

  return stack;
}


export async function deleteBookStack(
  stackId: string
): Promise<void> {
  const userId =
    await getCurrentUserId();

  const {
    error,
  } =
    await supabase
      .from(
        'book_stacks'
      )
      .delete()
      .eq(
        'id',
        stackId
      )
      .eq(
        'user_id',
        userId
      );

  if (error) {
    throw error;
  }
}


export async function updateBookStack(stackId: string, name: string, items: BookStackDraftItem[]): Promise<BookStack> {
  return saveBookStackSubmission({ name, items, stackId });
}
