import { publicationFields, screeningText } from './ugc-contract.mjs';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info,x-upsert', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
export class ScreeningError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function screeningResponse(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ code: 'NOVORI_MODERATION', message, error: message, ...extra }), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export async function readLimited(request, limit) {
  if (Number(request.headers.get('content-length') ?? 0)>limit) throw new ScreeningError('This submission is too large.',413);
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  const chunks=[];let size=0;
  try {while(true) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new ScreeningError('This submission is too large.',413);}chunks.push(value);}}
  finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function moderationIdentity(client, request, version) {
  const authorization = request.headers.get('Authorization') ?? '';
  const token = /^Bearer (.+)$/i.exec(authorization)?.[1];
  if (!token) throw new ScreeningError('Sign in to publish.', 401);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw new ScreeningError('Sign in again to publish.', 401);
  const user = data.user;
  const [active, restricted] = await Promise.all([
    client.rpc('novori_account_active', { reader_id: user.id }),
    client.rpc('novori_reader_restricted', { p_user: user.id }),
  ]);
  if (active.error || restricted.error) throw new ScreeningError('Safety checks are temporarily unavailable. Please retry.', 503);
  if (!active.data || restricted.data) throw new ScreeningError('Your account cannot publish. Contact support@novori.link.', 403);
  const metadata = user.user_metadata ?? {};
  if (metadata.terms_version !== version || metadata.privacy_version !== version || metadata.adult_confirmed !== true) throw new ScreeningError('Accept the current Novori terms before publishing.', 403);
  return { user, authorization };
}
export async function digest(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
export const MODERATION_CATEGORIES = ['harassment','harassment/threatening','hate','hate/threatening','illicit','illicit/violent','self-harm','self-harm/intent','self-harm/instructions','sexual','sexual/minors','violence','violence/graphic'];
export async function classify(input, key, transport = fetch) {
  if (!key) throw new ScreeningError('Publishing safety checks are not configured yet. Please retry later.', 503);
  const response = await transport('https://api.openai.com/v1/moderations', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'omni-moderation-latest', input }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new ScreeningError('Safety checks are temporarily unavailable. Nothing has been published; please retry.', 503);
  let result;
  try { result = await response.json(); } catch { throw new ScreeningError('Safety checks returned an invalid result. Please retry.', 503); }
  const record = result.results?.[0];
  if (typeof record?.flagged !== 'boolean' || !record.categories || MODERATION_CATEGORIES.some(category=>typeof record.categories[category]!=='boolean') || Object.values(record.categories).some(value => typeof value !== 'boolean')) throw new ScreeningError('Safety checks returned an invalid result. Please retry.', 503);
  return { flagged: record.flagged || Object.values(record.categories).some(Boolean), categories: record.categories, model: result.model ?? 'omni-moderation-latest' };
}
export async function recordScreening(client, userId, requestKey, surface, content, result, mediaPath = null) {
  const r = await client.rpc('novori_record_screening', { p_user: userId, p_key: requestKey, p_surface: surface, p_content: content, p_flagged: result.flagged, p_categories: result.categories, p_model: result.model, p_media: mediaPath });
  if (r.error) throw new ScreeningError('Could not record the safety check. Please retry.', 503);
  return r.data;
}
export function createPublicationHandler({ client, supabaseUrl, publishableKey, openaiKey, legalVersion, catalogImageHosts = /** @type {string[]} */ ([]), transport = fetch }) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return screeningResponse('Unsupported method.', 405);
    try {
      const { user, authorization } = await moderationIdentity(client, request, legalVersion);
      const raw = new TextDecoder().decode(await readLimited(request,100000));
      if (raw.length > 100000) throw new ScreeningError('This submission is too large.', 413);
      let envelope;
      try { envelope = JSON.parse(raw); } catch { throw new ScreeningError('Invalid submission.'); }
      const { path, query = '', method, body, prefer = '', accept = '' } = envelope;
      if (typeof path !== 'string' || !['POST', 'PATCH', 'PUT'].includes(method) || typeof query !== 'string' || (query && !query.startsWith('?')) || query.length > 4000) throw new ScreeningError('Invalid submission.');
      let fields;try {fields=publicationFields(path,body);}catch {throw new ScreeningError('Invalid publication.');}
      if (fields === null) throw new ScreeningError('Unsupported publishing path.');
      for (const row of fields) for (const name of (path==='posts'?['post_image_url']:path==='profiles'?['avatar_url']:path==='clubs'?['cover_url']:[])) {
        const image = row[name];
        if (!image) continue;
        if (typeof image !== 'string') throw new ScreeningError('Invalid image reference.');
        const imageUrl = new URL(image);
        const match = /^\/storage\/v1\/object\/public\/(post-media|avatars|club-covers)\/(.+)$/.exec(imageUrl.pathname);
        if (imageUrl.origin !== new URL(supabaseUrl).origin || !match) throw new ScreeningError('Upload this image through Novori before publishing.');
        const asset = await client.from('novori_moderated_media').select('blocked,user_id').eq('bucket', match[1]).eq('path', decodeURIComponent(match[2])).maybeSingle();
        if (asset.error || !asset.data || asset.data.blocked || asset.data.user_id !== user.id) throw new ScreeningError('This image has not passed publication checks.');
      }
      // Catalog artwork keeps its existing resolution and provider path. Only
      // known provider image hosts are accepted as catalog references; user photos
      // use the approved asset registry above. Extend via server config if a new
      // catalog provider is deliberately adopted.
      const catalogHosts=new Set(['books.google.com','books.googleusercontent.com','images.isbndb.com','assets.hardcover.app','covers.openlibrary.org','m.media-amazon.com','images-na.ssl-images-amazon.com','images-eu.ssl-images-amazon.com',...catalogImageHosts]);
      function checkCatalogImages(value) {
        if(Array.isArray(value)){value.forEach(checkCatalogImages);return;}
        if(!value||typeof value!=='object')return;
        for(const [name,image]of Object.entries(value)) {
          if(['book_cover_url','coverUrl'].includes(name) || (name==='cover_url' && ['user_books','book_stack_items'].includes(path))) {
            if(!image)continue;
            const url=new URL(image);
            if(!catalogHosts.has(url.hostname)||!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new ScreeningError('Choose this book through Novori search before sharing its cover.');
          }else checkCatalogImages(image);
        }
      }
      checkCatalogImages(body);
      const params = new URLSearchParams(query);
      // PostgREST schema selection/headers are deliberately not caller-controlled.
      const binding = [...params.entries()].filter(([key]) => !['select', 'limit', 'offset', 'order'].includes(key)).sort().map(([key, value]) => [key, value]);
      const rows=Array.isArray(body)?body:[body];
      const targets=rows.map(row=>Object.fromEntries(Object.entries(row).filter(([name])=>name==='id'||name==='stack_id'||name==='author_id'||name==='user_id'||name==='club_id'||name==='google_book_id'||name.endsWith('_id')).sort(([a],[b])=>a.localeCompare(b))));
      const key = await digest(JSON.stringify({ user: user.id, path, method, binding, targets, fields }));
      const quota = await client.rpc('novori_claim_screening', { p_user: user.id, p_key: key });
      if (quota.error || !quota.data?.allowed) throw new ScreeningError('Too many publishing attempts. Please wait a minute and retry.', 429);
      const text = screeningText(fields);
      if (text.length > 30000) throw new ScreeningError('This submission is too large.', 413);
      let state = quota.data.state;
      if (!['approved', 'passed'].includes(state)) {
        if (state === 'rejected') return screeningResponse('This content was rejected. Edit it before submitting, or contact support@novori.link to appeal.', 422);
        if (state === 'pending') return screeningResponse('This content is waiting for review. After approval, submit it again. You can contact support@novori.link.', 422);
        const result = text.trim() ? await classify(text, openaiKey, transport) : { flagged: false, categories: {}, model: 'no-user-text' };
        const saved = await recordScreening(client, user.id, key, path, fields, result);
        state = saved.state;
        if (!['approved', 'passed'].includes(state)) return screeningResponse('This content needs a safety review. Nothing was published. After approval, submit it again; support@novori.link can help.', 422, { review_id: saved.id });
      }
      // The secret ticket is never returned to the native client. Forward the
      // original body with the verified reader JWT: ordinary RLS/RPC permissions remain.
      const ticket = await client.rpc('novori_issue_publication_ticket', { p_user: user.id, p_path: `/${path}`, p_key: key, p_version: legalVersion });
      if (ticket.error) throw new ScreeningError('Could not authorize publication. Please retry.', 503);
      const headers = { Authorization: authorization, apikey: publishableKey, 'Content-Type': 'application/json', 'X-Novori-Moderation-Ticket': ticket.data };
      const allowedPreferences = prefer.split(',').map(v => v.trim()).filter(v => /^(return=(representation|minimal)|resolution=(merge-duplicates|ignore-duplicates)|missing=default|count=(exact|planned|estimated))$/.test(v));
      // Preserve Supabase .single() response semantics across the gateway.
      // Allow only the object media type, never caller-controlled schema headers.
      if (accept === 'application/vnd.pgrst.object+json') headers.Accept = accept;
      if (allowedPreferences.length) headers.Prefer = allowedPreferences.join(',');
      try {
        const forwarded = await transport(`${supabaseUrl}/rest/v1/${path}${query}`, { method, headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
        const responseHeaders = new Headers(cors);
        for (const header of ['content-type', 'content-range', 'preference-applied']) if (forwarded.headers.has(header)) responseHeaders.set(header, forwarded.headers.get(header));
        responseHeaders.set('Cache-Control', 'no-store');
        return new Response(forwarded.body, { status: forwarded.status, headers: responseHeaders });
      } finally {
        await client.from('novori_publication_tickets').delete().eq('id', ticket.data);
      }
    } catch (error) {
      return screeningResponse(error instanceof ScreeningError ? error.message : 'Could not confirm publication. Check whether it appeared before retrying.', error instanceof ScreeningError ? error.status : 503);
    }
  };
}
