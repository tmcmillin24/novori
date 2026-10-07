import { supabase } from './supabase';

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

  return (
    (data ?? []) as
      BookCartItem[]
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

  return (
    data as
      BookCartItem | null
  );
}

export async function addBookToCart(
  input: AddBookToCartInput
): Promise<BookCartItem> {
  const userId =
    await getCurrentUserId();

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

  const {
    error,
  } =
    await supabase
      .from('book_cart_items')
      .delete()
      .eq(
        'user_id',
        userId
      )
      .eq(
        'google_book_id',
        googleBookId
      );

  if (error) {
    throw error;
  }
}
