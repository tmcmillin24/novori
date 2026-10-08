jest.mock('../src/lib/resolve-discovery-book', () => ({ resolveDiscoveryBook: jest.fn(async () => null) }));
jest.mock('react-native', () => ({ Image: { getSize: jest.fn() } }));
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn() } }));
jest.mock('../src/lib/canonical-book-covers', () => ({ getCanonicalBookCoverMetadata: jest.fn(()=>null), publishCatalogCovers: jest.fn(), resolveCanonicalBookCover: jest.fn(async () => null) }));
import { Image } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { resolveDiscoveryBook } from '../src/lib/resolve-discovery-book';
import { publishCatalogCovers, resolveCanonicalBookCover } from '../src/lib/canonical-book-covers';
import { prepareDiscovery, discoveryAuthorKey, readValidatedDiscovery } from '../src/lib/validated-discovery';
const card=(id:number,covered=true)=>({id,title:`Book ${id}`,authors:[`Writer ${id}`],isbns:[],coverBookId:covered?`edition-${id}`:null,coverUrl:covered?`https://art/${id}.jpg`:null,coverPolicyVersion:7});
beforeEach(() => {
 jest.clearAllMocks();
 (resolveDiscoveryBook as jest.Mock).mockReset().mockImplementation(async book=>`edition-${book.id}`);
 (resolveCanonicalBookCover as jest.Mock).mockReset().mockImplementation(async ({googleBookId})=>`https://art/${googleBookId}.jpg`);
});
test.each([['trending',2,100],['recent',5,200]] as const)('%s publishes its short cached row immediately, then fills twenty distinct authors',async(kind,count,base)=>{
 const target=kind==='trending'?50:20;
 const books=Array.from({length:70},(_,i)=>card(base+i,i<count));
 const updates: typeof books[]=[];
 const result=await prepareDiscovery(kind,books,{onProgress:cards=>updates.push(cards)});
 expect(updates[0]).toEqual(books.slice(0,count));
 expect(result).toHaveLength(target);
 expect(new Set(result.map(discoveryAuthorKey)).size).toBe(target);
 expect(resolveDiscoveryBook).toHaveBeenCalledTimes(target-count);
 expect(Image.getSize).not.toHaveBeenCalled(); expect(ExpoImage.prefetch).not.toHaveBeenCalled();
 jest.clearAllMocks();
 expect(await prepareDiscovery(kind,books)).toHaveLength(target);
 expect(resolveDiscoveryBook).not.toHaveBeenCalled(); expect(resolveCanonicalBookCover).not.toHaveBeenCalled();
});
test('skips excluded books and repeated authors and limits resolution concurrency to two',async()=>{
 const books=Array.from({length:30},(_,i)=>card(300+i,i===0));
 books[1].authors=['WRITER 300'];
 let active=0,peak=0;
 (resolveDiscoveryBook as jest.Mock).mockImplementation(async book=>{
  active++; peak=Math.max(peak,active); await Promise.resolve(); active--; return `edition-${book.id}`;
 });
 const result=await prepareDiscovery('eligible',books,{isEligible:book=>book.id!==302});
 expect(result).toHaveLength(20);
 expect(resolveDiscoveryBook).not.toHaveBeenCalledWith(expect.objectContaining({id:301}));
 expect(resolveDiscoveryBook).not.toHaveBeenCalledWith(expect.objectContaining({id:302}));
 expect(peak).toBeLessThanOrEqual(2);
});
test('a full cached row makes no missing-book requests',async()=>{
 const books=Array.from({length:25},(_,i)=>card(400+i,i<20));
 expect(await prepareDiscovery('warm',books)).toHaveLength(20);
 expect(resolveDiscoveryBook).not.toHaveBeenCalled();
});
test('failures stop at forty lookups and preserve the last good feed',async()=>{
 const saved=[card(500)];
 await prepareDiscovery('failures',saved);
 (resolveDiscoveryBook as jest.Mock).mockResolvedValue(null);
 expect(await prepareDiscovery('failures',Array.from({length:100},(_,i)=>card(501+i,false)))).toEqual(saved);
 expect(resolveDiscoveryBook).toHaveBeenCalledTimes(40);
 expect(await prepareDiscovery('failures',[])).toEqual(saved);
});
test('superseded fills cannot publish or persist late cards',async()=>{
 let current=true,finish!: (value:string)=>void;
 (resolveDiscoveryBook as jest.Mock).mockImplementation(()=>new Promise<string>(resolve=>{finish=resolve;}));
 const updates: unknown[]=[];
 const pending=prepareDiscovery('cancelled',[card(700),card(701,false)],{isCurrent:()=>current,onProgress:cards=>updates.push(cards)});
 for(let i=0;i<20&&!finish;i++) await Promise.resolve();
 current=false; finish('edition-701');
 expect(await pending).toEqual([]);
 expect(updates).toHaveLength(1);
 expect(await readValidatedDiscovery('cancelled')).toEqual([card(700)]);
});
test('older version markers do not suppress catalog cards; verified alternatives are preserved',async()=>{
 const book={...card(800),coverPolicyVersion:6,coverAlternatives:[{bookId:'replacement',url:'https://art/replacement.jpg'}]};
 expect(await prepareDiscovery('legacy',[book])).toEqual([book]);
 expect(publishCatalogCovers).toHaveBeenCalledWith({'edition-800':'https://art/800.jpg'},expect.objectContaining({'edition-800':expect.objectContaining({alternatives:['https://art/800.jpg','https://art/replacement.jpg']})}));
});

test('server-selected Hardcover cards are displayed and cached without requiring catalog route IDs',async()=>{
 const books=Array.from({length:50},(_,i)=>({...card(5000+i),coverBookId:null,coverProvider:'hardcover',coverWorkId:`hardcover:${5000+i}`}));
 expect(await prepareDiscovery('trending',books)).toEqual(books);
 expect(resolveDiscoveryBook).not.toHaveBeenCalled();
 expect(publishCatalogCovers).toHaveBeenCalledWith(expect.objectContaining({hc_art_5000:books[0].coverUrl}),expect.objectContaining({hc_art_5000:expect.objectContaining({provider:'hardcover',workId:'hardcover:5000'})}));
 expect(await readValidatedDiscovery('trending')).toEqual(books);
});

test('fallback publication does not renew a saved pool and source age survives repeated preparation', async()=>{
 const sourceSavedAt=Date.now()-6*86400000;
 const books=[card(98765)];
 await prepareDiscovery('source-age',books,{sourceSavedAt});
 jest.useFakeTimers(); jest.setSystemTime(Date.now()+2*86400000);
 expect(await readValidatedDiscovery('source-age')).toEqual([]);
 jest.useRealTimers();
 await prepareDiscovery('fallback-age',books,{sourceSavedAt});
 await prepareDiscovery('fallback-age',[]);
 jest.useFakeTimers(); jest.setSystemTime(Date.now()+2*86400000);
 expect(await readValidatedDiscovery('fallback-age')).toEqual([]);
 jest.useRealTimers();
});
