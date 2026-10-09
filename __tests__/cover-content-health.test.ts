import {readFileSync} from 'fs';
import {webcrypto} from 'crypto';
import {coverContentStatus,rejectedCoverContent} from '../supabase/functions/_shared/cover-content-health';
const placeholder=readFileSync(`${__dirname}/fixtures/isbndb-missing-cover.jpg`);
const priorCrypto=global.crypto;
beforeAll(()=>{Object.defineProperty(global,'crypto',{value:webcrypto,configurable:true});});
afterAll(()=>{Object.defineProperty(global,'crypto',{value:priorCrypto,configurable:true});});
function client(rows:any[]=[]) {
 const upsert=jest.fn(async(_row:any,_options?:any)=>({error:null}));
 return {upsert,from:()=>({select:()=>({in:()=>({gt:async()=>({data:rows,error:null})})}),upsert})};
}
test('rejects actual successfully served ISBNdb missing-cover JPEG, not grayscale by heuristic',async()=>{
 expect(await coverContentStatus(placeholder)).toBe('placeholder');
 expect(await coverContentStatus(new Uint8Array([255,216,255,0,1,2]))).toBe('image');
 expect(await coverContentStatus(new TextEncoder().encode('404 page not found'))).toBeNull();
});
test('persists a content rejection once and shares it across later URL checks',async()=>{
 const db=client();const url='https://images.isbndb.com/covers/content-test.jpg';
 const fetcher=jest.fn(async()=>new Response(placeholder,{status:200})) as unknown as typeof fetch;
 expect(await rejectedCoverContent(db,[url],fetcher)).toEqual(new Set([url]));
 expect(await rejectedCoverContent(db,[url],fetcher)).toEqual(new Set([url]));
 expect(fetcher).toHaveBeenCalledTimes(1);expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({url,status:'placeholder'}),{onConflict:'url'});
});
test('reads persisted placeholder decisions without CDN or provider requests',async()=>{
 const url='https://images.isbndb.com/covers/stored-placeholder.jpg';const db=client([{url,status:'placeholder',expires_at:new Date(Date.now()+86400000).toISOString()}]);
 const fetcher=jest.fn() as unknown as typeof fetch;
 expect(await rejectedCoverContent(db,[url],fetcher)).toEqual(new Set([url]));expect(fetcher).not.toHaveBeenCalled();
});
test('never probes Hardcover or untrusted hosts and does not reject transient failures',async()=>{
 const db=client();const fetcher=jest.fn(async()=>new Response('outage',{status:503})) as unknown as typeof fetch;
 expect(await rejectedCoverContent(db,['https://assets.hardcover.app/book.jpg','https://evil.example/image.jpg','https://images.isbndb.com/covers/transient.jpg'],fetcher)).toEqual(new Set());
 expect(fetcher).toHaveBeenCalledTimes(1);expect(db.upsert).not.toHaveBeenCalled();
});
test('an actual 404 is a short cached exclusion, while 503 remains retryable',async()=>{
 const url='https://images.isbndb.com/covers/missing-test.jpg';const db=client();
 const fetcher=jest.fn(async()=>new Response('not found',{status:404})) as unknown as typeof fetch;
 expect(await rejectedCoverContent(db,[url],fetcher)).toEqual(new Set([url]));
 expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({url,status:'missing'}),{onConflict:'url'});
 const expiry=Date.parse(db.upsert.mock.calls[0][0].expires_at);expect(expiry-Date.now()).toBeLessThanOrEqual(15*60000);
});
