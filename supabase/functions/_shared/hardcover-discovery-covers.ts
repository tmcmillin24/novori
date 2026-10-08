import { matchesSeriesCatalogEdition } from './series-book-catalog.ts';
import { cleanCatalogBookTitle } from './book-edition-metadata.ts';
import { normalizeBookGenres } from './book-genres.ts';
export const DISCOVERY_COVER_VARIANT = 'discovery_verified_v1';
const key = (value: string) => cleanCatalogBookTitle(value).toLowerCase().replace(/[^a-z0-9]/g,'');
export function safeHardcoverCoverUrl(value: unknown): string | null {
 try {
  const url = new URL(String(value));
  return url.protocol === 'https:' && !url.username && !url.password && !/placeholder|no[-_]?image|no[-_]?cover/i.test(url.pathname)
   && !url.searchParams.has('Expires') && !url.searchParams.has('X-Amz-Signature') ? url.toString() : null;
 } catch { return null; }
}
/** Server-fetched Hardcover work image is authoritative for Discovery artwork.
 * Edition fields prove identity/format elsewhere; they do not choose this image. */
export function hardcoverDiscoveryArt(book: any) {
 const url = safeHardcoverCoverUrl(book.image?.url) ?? safeHardcoverCoverUrl(book.default_cover_edition?.image?.url);
 return url && Number.isSafeInteger(book.id) && book.id > 0
  ? {version:2, source:'hardcover_work_image', hardcoverBookId:book.id, title:book.title, url} : null;
}
export type HardcoverDiscoveryChoice = {url:string;bookId:string;provider:string;locked:boolean;workId:string;genres:string[];reviewsCount:number|null;usersCount:number};
export function verifiedHardcoverDiscoveryChoice(seed: any, candidate: any): HardcoverDiscoveryChoice | null {
 const source = candidate.source_metadata, proof = source?.coverEdition, art = source?.coverProof;
 const workProof = art?.version === 2 && art.source === 'hardcover_work_image' &&
  art.hardcoverBookId === source.hardcoverBookId && art.url === candidate.url && art.title === source.title;
 const legacyProof = proof?.version === 1 && proof.nonAudio === true && proof.language === 'en' &&
  Number.isSafeInteger(proof.editionId) && proof.editionId > 0 &&
  /^(?:\d{13}|\d{9}[\dX])$/.test(proof.isbn ?? '') && proof.url === candidate.url && key(proof.title ?? '') === key(source.title ?? '');
 if (candidate.provider !== 'hardcover' || candidate.source_variant !== DISCOVERY_COVER_VARIANT ||
     !Number.isSafeInteger(source?.hardcoverBookId) || source.hardcoverBookId <= 0 ||
     !(workProof || legacyProof) || !matchesSeriesCatalogEdition(source, seed) || !safeHardcoverCoverUrl(candidate.url)) return null;
 return { url: candidate.url, bookId: seed.provider_book_id, provider: 'hardcover', locked: false,
  workId: `hardcover:${source.hardcoverBookId}`, genres: normalizeBookGenres(source.genres),
  reviewsCount: Number.isSafeInteger(source.reviewsCount) && source.reviewsCount >= 0 ? source.reviewsCount : null,
  usersCount: Number(source.usersCount) || 0 };
}

const stableJson = (value: any): string => JSON.stringify(value, (_key, child) =>
 child && typeof child === 'object' && !Array.isArray(child)
  ? Object.fromEntries(Object.keys(child).sort().map(key => [key,child[key]])) : child);

/** Reuse server-authored feed proofs, including after a cold ISBN lookup creates
 * an identity. No client URL is trusted and no provider request is made here. */
export async function cacheDiscoveryCoverChoices(admin: any, seeds: any[], discoveryBooks: any[] = []) {
 if (!seeds.length) return [];
 const { data: feeds, error } = await admin.from('novori_discover_cache').select('payload,refreshed_at')
  .in('cache_key', ['hardcover-trending:v8:90:100', 'hardcover-recent-releases:v5:18:150', 'hardcover-trending:v7:90:100', 'hardcover-recent-releases:v4:18:150']);
 if (error) console.warn('Could not read cached discovery artwork:', error);
 const rows = [...(feeds ?? []).slice().sort((a: any,b: any) => Date.parse(a.refreshed_at)-Date.parse(b.refreshed_at)).filter((feed: any) => Date.now() - Date.parse(feed.refreshed_at) < 7 * 86400000)
  .flatMap((feed: any) => Array.isArray(feed.payload?.books) ? feed.payload.books : []), ...discoveryBooks];
 const pending = new Map<string, any>();
 for (const row of rows) {
  if (row.formatPolicyVersion !== 1) continue;
  for (const seed of seeds) {
   if (!seed.id || !seed.work_id || !matchesSeriesCatalogEdition(row, seed)) continue;
   const candidate = { work_id: seed.work_id, edition_id: seed.id, provider: 'hardcover',
    source_variant: DISCOVERY_COVER_VARIANT, scope: 'edition', source_kind: 'image_link',
    external_id: String(row.id), url: row.coverProof?.url ?? row.coverEdition?.url,
    candidate_key: `hardcover:${row.id}:${seed.work_id}:${DISCOVERY_COVER_VARIANT}`,
    discovery_source: 'hardcover_discovery_verified', last_seen_at: new Date().toISOString(),
    source_metadata: { hardcoverBookId: row.id, title: row.title, authors: row.authors,
      coverEdition: row.coverEdition, coverProof: row.coverProof, genres: normalizeBookGenres(row.genres),
      usersCount: row.usersCount, reviewsCount: row.reviewsCount },
   };
   if (verifiedHardcoverDiscoveryChoice(seed, candidate)) {
    const prior = pending.get(candidate.candidate_key);
    if (!prior?.source_metadata.coverProof || candidate.source_metadata.coverProof) pending.set(candidate.candidate_key, candidate);
   }
  }
 }
 if (!pending.size) return [];
 try {
 const { data: stored, error: readError } = await admin.from('book_cover_candidates')
  .select('candidate_key,url,source_metadata').in('candidate_key', [...pending.keys()]);
 if (readError) throw readError;
 const known = new Map((stored ?? []).map((row: any) => [row.candidate_key,row]));
 const changed = [...pending.values()].filter(row => {
  const old: any = known.get(row.candidate_key);
  if (old?.source_metadata?.coverProof?.version === 2 && !row.source_metadata.coverProof) {
   pending.set(row.candidate_key, {...row,url:old.url,source_metadata:old.source_metadata});return false;
  }
  return !old || old.url !== row.url || stableJson(old.source_metadata) !== stableJson(row.source_metadata);
 });
 if (!changed.length) return [...pending.values()];
 const { error: writeError } = await admin.from('book_cover_candidates').upsert(changed,{onConflict:'candidate_key'});
 if (writeError) throw writeError;
 } catch (error) { console.warn('Could not persist Hardcover discovery artwork:', error); }
 // Persistence failures must not replace the server-selected image on this read.
 return [...pending.values()];
}
