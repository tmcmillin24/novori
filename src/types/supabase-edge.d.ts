// Shared catalog helpers use the same Supabase SDK types in Expo/Node and Deno.
declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export const createClient: typeof import('@supabase/supabase-js').createClient;
  export type SupabaseClient = import('@supabase/supabase-js').SupabaseClient;
}

// Ambient environment declaration for shared server helpers checked by Node tests.
// This does not provide a Deno runtime or certify deployed Edge functions.
declare const Deno: { env: { get(name: string): string | undefined } };
