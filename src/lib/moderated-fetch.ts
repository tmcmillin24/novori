import { MEDIA_BUCKETS, publicationFields } from '../../supabase/functions/_shared/ugc-contract.mjs';

// Route existing writes through one gateway. Reads, catalog APIs and private notes
// retain their existing transport. Database triggers independently enforce this.
export function createModeratedFetch(baseUrl: string, transport: typeof fetch = fetch): typeof fetch {
  const origin = new URL(baseUrl).origin;
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.origin !== origin || !['POST', 'PATCH', 'PUT'].includes(method)) return transport(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (url.pathname === '/auth/v1/signup' && method === 'POST') return transport(`${origin}/functions/v1/ugc-signup${url.search}`, { ...init, method: 'POST', headers, body: init?.body ?? (input instanceof Request ? await input.clone().text() : undefined) });
    const restPrefix = '/rest/v1/';
    if (url.pathname.startsWith(restPrefix)) {
      const path = url.pathname.slice(restPrefix.length);
      let body: unknown;
      try { body = JSON.parse(typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() : '{}'); }
      catch { return transport(input, init); }
      const fields = publicationFields(path, body);
      if (fields !== null && (path.startsWith('rpc/') || fields.some(row => Object.keys(row).length))) {
        return transport(`${origin}/functions/v1/ugc-publish`, {
          method: 'POST', headers: { Authorization: headers.get('Authorization') ?? '', apikey: headers.get('apikey') ?? '', 'Content-Type': 'application/json' },
          signal: init?.signal,
          body: JSON.stringify({ path, query: url.search, method, body, prefer: headers.get('Prefer') ?? '', accept: headers.get('Accept') ?? '' }),
        });
      }
    }
    const media = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(url.pathname);
    if (media && MEDIA_BUCKETS.includes(media[1])) {
      headers.delete('x-novori-moderation-ticket');
      return transport(`${origin}/functions/v1/ugc-media?bucket=${encodeURIComponent(media[1])}&path=${encodeURIComponent(decodeURIComponent(media[2]))}`, {
        ...init, method: 'POST', headers,
        body: init?.body ?? (input instanceof Request ? await input.clone().blob() : undefined),
      });
    }
    return transport(input, init);
  };
}
