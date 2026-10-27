import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import type { UserBook } from './user-books';
import { subscribeUserBookChanges } from './user-book-events';

/** Keep mounted detail pages in step with confirmed library writes elsewhere. */
export function useUserBookUpdates(bookId: string | undefined, onChange: (book: UserBook) => void) {
  const callback = useRef(onChange); callback.current = onChange;
  useEffect(() => {
    let active = true, authChanged = false;
    let userId: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true; userId = session?.user.id ?? null;
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !authChanged && !error) userId = data.session?.user.id ?? null;
    }).catch(() => {});
    const unsubscribe = subscribeUserBookChanges(book => {
      if (active && userId && book.user_id === userId && book.google_book_id === bookId) callback.current(book);
    });
    return () => { active = false; unsubscribe(); subscription.unsubscribe(); };
  }, [bookId]);
}
