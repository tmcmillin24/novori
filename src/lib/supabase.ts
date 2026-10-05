import AsyncStorage from '@react-native-async-storage/async-storage';
import { createModeratedFetch } from './moderated-fetch';
import {
  createClient,
} from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (
  !supabaseUrl ||
  !supabasePublishableKey
) {
  throw new Error(
    'Supabase environment variables are missing.'
  );
}

export const supabase =
  createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      global: { fetch: createModeratedFetch(supabaseUrl) },
      auth: {
        storage:
          AsyncStorage,
        autoRefreshToken:
          true,
        persistSession:
          true,
        detectSessionInUrl:
          false,
        flowType:
          'pkce',
      },
    }
  );
