import { supabase } from './supabase';

export type ProfilePrivacyPreferences = {
  show_books: boolean;
  show_reviews: boolean;
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

  return {
    show_books:
      row?.show_books ??
      true,
    show_reviews:
      row?.show_reviews ??
      true,
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
        show_books_value:
          preferences.show_books,
        show_reviews_value:
          preferences.show_reviews,
      }
    );

  if (error) {
    throw error;
  }
}
