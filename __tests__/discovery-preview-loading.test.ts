import { loadDiscoveryCover, resolveDiscoveryBook } from '../src/lib/resolve-discovery-book';
import { resolveGoogleBooksIdentity } from '../src/lib/google-books';
import { resolveCanonicalBookCover, getCanonicalBookCover, getCanonicalBookCoverMetadata, publishCatalogCovers } from '../src/lib/canonical-book-covers';
jest.mock('../src/lib/google-books',()=>({resolveGoogleBooksIdentity:jest.fn(async()=>({ok:true,googleBookId:'nv_preview'}))}));
jest.mock('../src/lib/book-search',()=>({searchNovoriBooks:jest.fn(async()=>[])}));
jest.mock('../src/lib/canonical-book-covers',()=>({resolveCanonicalBookCover:jest.fn(async()=> 'https://publisher/cover.jpg'),getCanonicalBookCover:jest.fn(()=>null),getCanonicalBookCoverMetadata:jest.fn(()=>null),publishCatalogCovers:jest.fn()}));
const row=(id:number)=>({id,title:'Book '+id,authors:['Writer'],isbns:['9780439023498'],coverUrl:null});
test('a preview resolves its verified cover without a tap, and repeated mounts reuse the result',async()=>{
 const book=row(80001);
 await Promise.all([loadDiscoveryCover(book),loadDiscoveryCover(book)]);
 expect(resolveGoogleBooksIdentity).toHaveBeenCalledTimes(1);
 expect(resolveCanonicalBookCover).toHaveBeenCalledWith({googleBookId:'nv_preview'},true);
 await loadDiscoveryCover(book);
 expect(resolveGoogleBooksIdentity).toHaveBeenCalledTimes(1);
});
test('a preview with an existing publisher cover needs no identity request',async()=>{
 const before=(resolveGoogleBooksIdentity as jest.Mock).mock.calls.length;
 await loadDiscoveryCover({...row(80002),coverUrl:'https://publisher/existing.jpg'});
 expect(resolveGoogleBooksIdentity).toHaveBeenCalledTimes(before);
});


test('mounted previews limit concurrent cold identity lookups to two',async()=>{
 let active=0, peak=0;
 const release:Array<()=>void>=[];
 (resolveGoogleBooksIdentity as jest.Mock).mockImplementation(()=>new Promise(resolve=>{
  active++;peak=Math.max(peak,active);
  release.push(()=>{active--;resolve({ok:true,googleBookId:'nv_limited'});});
 }));
 const jobs=[90001,90002,90003,90004].map(id=>loadDiscoveryCover(row(id)));
 const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
 await tick();expect(peak).toBe(2);
 while (release.length || active) { release.shift()?.();await tick(); }
 await Promise.all(jobs);expect(peak).toBe(2);
});

test('a verified tap adopts server-published Hardcover artwork without selecting the ISBNdb image',async()=>{
 (resolveGoogleBooksIdentity as jest.Mock).mockResolvedValue({ok:true,googleBookId:'nv_adopted'});
 (getCanonicalBookCover as jest.Mock).mockReturnValue('https://assets.hardcover.app/chosen.jpg');
 (getCanonicalBookCoverMetadata as jest.Mock).mockReturnValue({provider:'hardcover',workId:'hardcover:91000',genres:['Fantasy']});
 const before=(resolveCanonicalBookCover as jest.Mock).mock.calls.length;
 expect(await resolveDiscoveryBook(row(91000))).toBe('nv_adopted');
 expect(publishCatalogCovers).toHaveBeenCalledWith({nv_adopted:'https://assets.hardcover.app/chosen.jpg'},expect.objectContaining({nv_adopted:expect.objectContaining({provider:'hardcover',workId:'hardcover:91000'})}));
 expect(resolveCanonicalBookCover).toHaveBeenCalledTimes(before);
});
