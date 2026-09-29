import { supabase } from './supabase';
import {
  CanonicalBookPresentation,
  getCanonicalBookPresentations,
} from './user-books';

export type BookCartItem = {
  id: string;
  user_id: string;
  google_book_id: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  isbn: string | null;
  created_at: string;
};

function applyCanonicalCartPresentation(
  item: BookCartItem,
  canonical:
    CanonicalBookPresentation
    | undefined
) {
  if (!canonical) {
    return item;
  }

  return {
    ...item,
    title:
      canonical.title ||
      item.title,
    authors:
      canonical.authors.length >
        0
        ? canonical.authors
        : item.authors,
    cover_url:
      canonical.coverUrl ??
      item.cover_url,
    isbn:
      canonical.isbn ??
      item.isbn,
  };
}

type AddBookToCartInput = {
  googleBookId: string;
  title: string;
  authors?: string[];
  coverUrl?: string | null;
  isbn?: string | null;
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
      'You must be signed in to manage your Book Cart.'
    );
  }

  return user.id;
}

export async function getBookCart(): Promise<
  BookCartItem[]
> {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } =
    await supabase
      .from('book_cart_items')
      .select('*')
      .eq('user_id', userId)
      .order(
        'created_at',
        {
          ascending: false,
        }
      );

  if (error) {
    throw error;
  }

  const items =
    (
      data ??
      []
    ) as
      BookCartItem[];

  const canonicalBooks =
    await getCanonicalBookPresentations(
      items.map(
        (
          item
        ) =>
          item.google_book_id
      )
    );

  return items.map(
    (
      item
    ) =>
      applyCanonicalCartPresentation(
        item,
        canonicalBooks.get(
          item.google_book_id
        )
      )
  );
}

export async function getBookCartItem(
  googleBookId: string
): Promise<BookCartItem | null> {
  const userId =
    await getCurrentUserId();

  const {
    data,
    error,
  } =
    await supabase
      .from('book_cart_items')
      .select('*')
      .eq(
        'user_id',
        userId
      )
      .eq(
        'google_book_id',
        googleBookId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  let item =
    data as
      BookCartItem | null;

  if (!item) {
    const {
      data:
        candidateRows,
      error:
        candidateError,
    } =
      await supabase
        .from(
          'book_cart_items'
        )
        .select('*')
        .eq(
          'user_id',
          userId
        );

    if (candidateError) {
      throw candidateError;
    }

    const candidates =
      (
        candidateRows ??
        []
      ) as BookCartItem[];

    const canonicalBooks =
      await getCanonicalBookPresentations([
        googleBookId,
        ...candidates.map(
          (
            candidate
          ) =>
            candidate.google_book_id
        ),
      ]);

    const targetCanonicalId =
      canonicalBooks.get(
        googleBookId
      )?.googleBookId ??
      googleBookId;

    item =
      candidates.find(
        (
          candidate
        ) =>
          (
            canonicalBooks.get(
              candidate.google_book_id
            )?.googleBookId ??
            candidate.google_book_id
          ) ===
            targetCanonicalId
      ) ??
      null;

    if (!item) {
      return null;
    }

    return applyCanonicalCartPresentation(
      item,
      canonicalBooks.get(
        item.google_book_id
      )
    );
  }

  const canonicalBooks =
    await getCanonicalBookPresentations([
      item.google_book_id,
    ]);

  return applyCanonicalCartPresentation(
    item,
    canonicalBooks.get(
      item.google_book_id
    )
  );
}

export async function addBookToCart(
  input: AddBookToCartInput
): Promise<BookCartItem> {
  const userId =
    await getCurrentUserId();

  const existing =
    await getBookCartItem(
      input.googleBookId
    );

  if (existing) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'book_cart_items'
        )
        .update({
          title:
            input.title,
          authors:
            input.authors ??
            [],
          cover_url:
            input.coverUrl ??
            existing.cover_url,
          isbn:
            input.isbn ??
            existing.isbn,
        })
        .eq(
          'id',
          existing.id
        )
        .eq(
          'user_id',
          userId
        )
        .select('*')
        .single();

    if (error) {
      throw error;
    }

    return data as
      BookCartItem;
  }

  const {
    data,
    error,
  } =
    await supabase
      .from('book_cart_items')
      .upsert(
        {
          user_id:
            userId,
          google_book_id:
            input.googleBookId,
          title:
            input.title,
          authors:
            input.authors ??
            [],
          cover_url:
            input.coverUrl ??
            null,
          isbn:
            input.isbn ??
            null,
        },
        {
          onConflict:
            'user_id,google_book_id',
        }
      )
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return data as
    BookCartItem;
}

export async function removeBookFromCart(
  googleBookId: string
): Promise<void> {
  const userId =
    await getCurrentUserId();

  const item =
    await getBookCartItem(
      googleBookId
    );

  if (!item) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        'book_cart_items'
      )
      .delete()
      .eq(
        'user_id',
        userId
      )
      .eq(
        'id',
        item.id
      );

  if (error) {
    throw error;
  }
}
