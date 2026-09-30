import { supabase } from './supabase';

export type ProfilePrivacyPreferences = {
  is_private: boolean;
  show_books: boolean;
  show_reviews: boolean;
  show_tbr_books: boolean;
  show_reading_books: boolean;
  show_read_books: boolean;
  show_dnf_books: boolean;
  show_owned_books: boolean;
};

export const DEFAULT_PROFILE_PRIVACY:
ProfilePrivacyPreferences = {
  is_private: false,
  show_books: true,
  show_reviews: true,
  show_tbr_books: true,
  show_reading_books: true,
  show_read_books: true,
  show_dnf_books: true,
  show_owned_books: true,
};

export async function getProfilePrivacy():
Promise<ProfilePrivacyPreferences> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_my_profile_privacy'
    );

  if (error) {
    throw error;
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data;

  const showTbrBooks =
    row?.show_tbr_books ??
    true;

  const showReadingBooks =
    row?.show_reading_books ??
    true;

  const showReadBooks =
    row?.show_read_books ??
    true;

  const showDnfBooks =
    row?.show_dnf_books ??
    true;

  const showOwnedBooks =
    row?.show_owned_books ??
    true;

  return {
    is_private:
      row?.is_private ??
      false,
    show_books:
      row?.show_books ??
      (
        showTbrBooks ||
        showReadingBooks ||
        showReadBooks ||
        showDnfBooks ||
        showOwnedBooks
      ),
    show_reviews:
      row?.show_reviews ??
      true,
    show_tbr_books:
      showTbrBooks,
    show_reading_books:
      showReadingBooks,
    show_read_books:
      showReadBooks,
    show_dnf_books:
      showDnfBooks,
    show_owned_books:
      showOwnedBooks,
  };
}

export async function updateProfilePrivacy(
  preferences:
    ProfilePrivacyPreferences
) {
  const showBooks =
    preferences.show_tbr_books ||
    preferences.show_reading_books ||
    preferences.show_read_books ||
    preferences.show_dnf_books ||
    preferences.show_owned_books;

  const {
    error,
  } =
    await supabase.rpc(
      'set_my_profile_privacy',
      {
        is_private_value:
          preferences.is_private,
        show_books_value:
          showBooks,
        show_reviews_value:
          preferences.show_reviews,
        show_tbr_books_value:
          preferences.show_tbr_books,
        show_reading_books_value:
          preferences.show_reading_books,
        show_read_books_value:
          preferences.show_read_books,
        show_dnf_books_value:
          preferences.show_dnf_books,
        show_owned_books_value:
          preferences.show_owned_books,
      }
    );

  if (error) {
    throw error;
  }

  // Keep the legacy profile column synchronized for any older
  // app/session code that still reads Owned visibility there.
  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (
    user
  ) {
    const {
      error:
        ownedVisibilityError,
    } =
      await supabase
        .from(
          'profiles'
        )
        .update({
          show_owned_books:
            preferences.show_owned_books,
        })
        .eq(
          'id',
          user.id
        );

    if (
      ownedVisibilityError
    ) {
      throw ownedVisibilityError;
    }
  }
}
