// Attach to media.novori.link/* in the novori.link zone. Worker subrequest
// caching is explicit; Cloudflare CSAM coverage must be verified after deployment.
export default {
  async fetch(request, env) {
    if (!['GET','HEAD'].includes(request.method)) return new Response(null, { status: 405 });
    const url = new URL(request.url);
    const match = /^\/(post-media|avatars|club-covers)\/([a-zA-Z0-9/_.-]+)$/.exec(url.pathname);
    if (!match || match[2].includes('..') || !env.SUPABASE_URL || !env.NOVORI_MEDIA_ORIGIN_SECRET) return new Response(null, { status: 404 });
    const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
    const cache = caches.default;
    const upstream = new URL('/functions/v1/ugc-media-origin', env.SUPABASE_URL);
    upstream.searchParams.set('bucket', match[1]); upstream.searchParams.set('path', match[2]);
    const cached = await cache.match(cacheKey);
    if (cached) {
      // Cached bytes never override removal/ban/deletion at the private origin.
      const access = await fetch(upstream,{method:'HEAD',headers:{'X-Novori-Media-Origin':env.NOVORI_MEDIA_ORIGIN_SECRET},redirect:'manual'});
      if (access.status >= 300 && access.status < 400) return new Response(null,{status:502,headers:{'Cache-Control':'no-store'}});
      if (!access.ok) {await cache.delete(cacheKey);return new Response(null,{status:access.status,headers:{'Cache-Control':'no-store'}});}
      const headers = new Headers(cached.headers); headers.set('X-Novori-Media-Cache','HIT');headers.set('Cache-Control','no-store');
      return new Response(request.method === 'HEAD' ? null : cached.body, { status: cached.status, headers });
    }
    const response = await fetch(upstream, {
      method: 'GET', headers: { 'X-Novori-Media-Origin': env.NOVORI_MEDIA_ORIGIN_SECRET },
      redirect: 'manual',
    });
    if (response.status >= 300 && response.status < 400) return new Response(null,{status:502,headers:{'Cache-Control':'no-store'}});
    const headers = new Headers(response.headers);
    headers.delete('set-cookie'); headers.set('X-Content-Type-Options', 'nosniff');
    if (response.ok) await cache.put(cacheKey, new Response(response.clone().body, { status: response.status, headers }));
    headers.set('X-Novori-Media-Cache','MISS');headers.set('Cache-Control','no-store');
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
  },
};
