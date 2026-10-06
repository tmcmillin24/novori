import { getServerKey } from './supabase-keys.mjs';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { attachDiscoveryCatalogCovers } from './discovery-cover-catalog.ts';

export async function applyCanonicalDiscoveryCovers(payload: Record<string, unknown>) {
  if (!Array.isArray(payload.books) || !payload.books.length) return payload;
  const url = Deno.env.get('SUPABASE_URL');
  const key = getServerKey(name => Deno.env.get(name));
  if (!url || !key) return payload;
  try {
    return await attachDiscoveryCatalogCovers(createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    }), payload);
  } catch (error) {
    console.warn('Could not overlay verified discovery covers:', error);
    return payload;
  }
}
