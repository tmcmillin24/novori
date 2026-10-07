// Shared catalog helpers use the same Supabase SDK types in Expo/Node and Deno.
declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export type SupabaseClient = import('@supabase/supabase-js').SupabaseClient;
}
