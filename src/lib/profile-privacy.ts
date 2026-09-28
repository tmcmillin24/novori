import { supabase } from './supabase';

export type ProfilePrivacyPreferences = {
  is_private: boolean;
  show_books: boolean;
  show_reviews: boolean;
  show_owned_books: boolean;
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

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  let showOwnedBooks =
    false;

  if (
    user
  ) {
    const {
      data:
        profileRow,
      error:
        profileError,
    } =
      await supabase
        .from(
          'profiles'
        )
        .select(
          'show_owned_books'
        )
        .eq(
          'id',
          user.id
        )
        .maybeSingle();

    if (
      profileError
    ) {
      throw profileError;
    }

    showOwnedBooks =
      Boolean(
        profileRow
          ?.show_owned_books
      );
  }

  return {
    is_private:
      row?.is_private ??
      false,
    show_books:
      row?.show_books ??
      true,
    show_reviews:
      row?.show_reviews ??
      true,
    show_owned_books:
      showOwnedBooks,
  };
}

export async function updateProfilePrivacy(
  preferences:
    ProfilePrivacyPreferences
) {
  const {
    error,
  } =
    await supabase.rpc(
      'set_my_profile_privacy',
      {
        is_private_value:
          preferences.is_private,
        show_books_value:
          preferences.show_books,
        show_reviews_value:
          preferences.show_reviews,
      }
    );

  if (error) {
    throw error;
  }

  const {
    data: {
      user,
    },
    error:
      userError,
  } =
    await supabase.auth.getUser();

  if (
    userError
  ) {
    throw userError;
  }

  if (
    !user
  ) {
    throw new Error(
      'You must be signed in to update profile privacy.'
    );
  }

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
