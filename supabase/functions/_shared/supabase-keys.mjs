/** @param {(name: string) => string | undefined} read */
export function getServerKey(read) {
  const explicit = read('NOVORI_SERVER_KEY');
  if (explicit) {
    if (!explicit.startsWith('sb_secret_')) throw new Error('NOVORI_SERVER_KEY must be a Supabase secret key.');
    return explicit;
  }
  return modernKey(read('SUPABASE_SECRET_KEYS'), 'sb_secret_') ?? read('SUPABASE_SERVICE_ROLE_KEY');
}

/** @param {(name: string) => string | undefined} read */
export function getPublishableKey(read) {
  const explicit = read('NOVORI_PUBLISHABLE_KEY');
  if (explicit) {
    if (!explicit.startsWith('sb_publishable_')) throw new Error('NOVORI_PUBLISHABLE_KEY must be a Supabase publishable key.');
    return explicit;
  }
  return modernKey(read('SUPABASE_PUBLISHABLE_KEYS'), 'sb_publishable_') ?? read('SUPABASE_ANON_KEY');
}

/** @param {string | undefined} raw @param {string} prefix */
function modernKey(raw, prefix) {
  if (!raw) return undefined;
  let keys;
  try { keys = JSON.parse(raw); } catch { throw new Error('Supabase injected key configuration is invalid.'); }
  if (!keys || Array.isArray(keys) || typeof keys !== 'object') throw new Error('Supabase injected key configuration is invalid.');
  const candidates = [keys.default, ...Object.values(keys)];
  return candidates.find(value => typeof value === 'string' && value.startsWith(prefix));
}
