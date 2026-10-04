import { supabase } from './supabase';

/** Sign out this device; a failed server logout may still have cleared its session. */
export async function signOutCurrentDevice() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || session) throw error;
  }
}
