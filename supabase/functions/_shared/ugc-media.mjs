import { MEDIA_BUCKETS } from './ugc-contract.mjs';
import { readLimited, ScreeningError, screeningResponse, moderationIdentity, digest, classify, recordScreening } from './ugc-screening.mjs';
const maxBytes = 8 * 1024 * 1024;
function dataUrl(bytes, type) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${type};base64,${btoa(binary)}`;
}
export function imageType(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length > 8 && bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') return 'image/png';
  if (bytes.length > 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  throw new ScreeningError('Choose a JPEG, PNG or WebP image.');
}
export function createMediaHandler({ client, openaiKey, legalVersion, transport = fetch }) {
  return async request => {
    if (request.method === 'OPTIONS') return screeningResponse('', 200);
    if (request.method !== 'POST') return screeningResponse('Unsupported method.', 405);
    try {
      const { user } = await moderationIdentity(client, request, legalVersion);
      const url = new URL(request.url), bucket = url.searchParams.get('bucket'), path = url.searchParams.get('path');
      if (!MEDIA_BUCKETS.includes(bucket) || !path || path.split('/')[0] !== user.id || path.includes('..') || !/^[a-zA-Z0-9/_.-]+$/.test(path) || path.length > 300) throw new ScreeningError('Invalid image destination.');
      if (bucket === 'club-covers') {
        const membership = await client.from('clubs').select('owner_id').eq('id', path.split('/')[1]).maybeSingle();
        if (membership.error || membership.data?.owner_id !== user.id) throw new ScreeningError('Only the club owner can replace this cover.', 403);
      }
      if (Number(request.headers.get('content-length') ?? 0) > maxBytes + 65536) throw new ScreeningError('Choose an image smaller than 8 MB.', 413);
      let bytes;
      const raw = await readLimited(request,maxBytes+65536);
      if (request.headers.get('content-type')?.includes('multipart/form-data')) {
        const form = await new Response(raw,{headers:{'Content-Type':request.headers.get('content-type')}}).formData();
        const file = form.get('') ?? form.get('file');
        if (!file || typeof file === 'string') throw new ScreeningError('Could not read the uploaded image. Choose the photo again.', 400);
        if (file.size > maxBytes) throw new ScreeningError('Choose an image smaller than 8 MB.', 413);
        bytes = new Uint8Array(await file.arrayBuffer());
      } else bytes = raw;
      if (!bytes.length || bytes.length > maxBytes) throw new ScreeningError('Choose an image smaller than 8 MB.', 413);
      const type = imageType(bytes), hash = await digest(bytes), key = await digest(`media:${user.id}:${bucket}:${hash}`);
      const blocked=await client.from('novori_blocked_image_hashes').select('sha256').eq('user_id',user.id).eq('sha256',hash).maybeSingle();
      if(blocked.error)throw new ScreeningError('Safety checks are unavailable. Please retry.',503);
      if(blocked.data)throw new ScreeningError('This image was removed by moderation. Choose another image or appeal at support@novori.link.',422);
      const quota = await client.rpc('novori_claim_screening', { p_user: user.id, p_key: key });
      if (quota.error || !quota.data?.allowed) throw new ScreeningError('Too many uploads. Wait a minute and retry.', 429);
      let state = quota.data.state;
      if (state === 'rejected') return screeningResponse('This image was rejected. Choose another image or contact support@novori.link to appeal.', 422);
      if (state === 'pending') return screeningResponse('This image is waiting for review. Upload it again after approval.', 422);
      if (!['passed', 'approved'].includes(state)) {
        const result = await classify([{ type: 'image_url', image_url: { url: dataUrl(bytes, type) } }], openaiKey, transport);
        let quarantine = null;
        if (result.flagged) {
          quarantine = `${user.id}/${hash}`;
          const upload = await client.storage.from('moderation-quarantine').upload(quarantine, bytes, { contentType: type, upsert: true });
          if (upload.error) throw new ScreeningError('Could not save the image for review. Nothing was published.', 503);
        }
        const saved = await recordScreening(client, user.id, key, `media:${bucket}`, { image_sha256: hash }, result, quarantine);
        state = saved.state;
        if (!['passed', 'approved'].includes(state)) return screeningResponse('This image needs a safety review. Nothing was published. Upload it again after approval.', 422, { review_id: saved.id });
      }
      // Never overwrite an approved asset: cached/scanned URLs stay immutable.
      const existing = await client.storage.from(bucket).list(path.slice(0, path.lastIndexOf('/')), { search: path.split('/').at(-1), limit: 1 });
      if (existing.error || existing.data?.some(file => file.name === path.split('/').at(-1))) throw new ScreeningError('Choose the image again to create a new upload.', 409);
      const upload = await client.storage.from(bucket).upload(path, bytes, { contentType: type, upsert: false, cacheControl: '3600' });
      if (upload.error) throw new ScreeningError('Could not save this image. Please retry.', 503);
      const registered = await client.from('novori_moderated_media').insert({ bucket, path, user_id: user.id, sha256: hash });
      if (registered.error) { await client.storage.from(bucket).remove([path]); throw new ScreeningError('Could not approve image delivery. Please retry.', 503); }
      return new Response(JSON.stringify({ Key: `${bucket}/${path}`, Id: upload.data.id }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
    } catch (error) { return screeningResponse(error instanceof ScreeningError ? error.message : 'Image safety checks are unavailable. Nothing was published; please retry.', error instanceof ScreeningError ? error.status : 503); }
  };
}
