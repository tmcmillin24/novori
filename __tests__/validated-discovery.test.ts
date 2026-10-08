jest.mock('../src/lib/resolve-discovery-book', () => ({ resolveDiscoveryBook: jest.fn(async () => null) }));
jest.mock('react-native', () => ({ Image: { getSize: jest.fn((_url, _success, failure) => failure()) } }));
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(async () => false) } }));
jest.mock('../src/lib/canonical-book-covers', () => ({ publishCatalogCovers: jest.fn(), resolveCanonicalBookCover: jest.fn(async () => null) }));
import { Image } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { resolveDiscoveryBook } from '../src/lib/resolve-discovery-book';
import { publishCatalogCovers } from '../src/lib/canonical-book-covers';
import { prepareDiscovery } from '../src/lib/validated-discovery';
const card=(id:string)=>({coverBookId:id,coverUrl:`https://art/${id}.jpg`,coverPolicyVersion:7});
beforeEach(() => jest.clearAllMocks());
test.each(['trending','recent'])('%s displays catalog cards from older deployments without waiting for image downloads',async kind=>{
 const cards=[card('good'),{...card('legacy'),coverPolicyVersion:6},{coverBookId:'older',coverUrl:'https://art/older.jpg'}];
 expect(await prepareDiscovery(kind,cards)).toEqual(cards);
 expect(Image.getSize).not.toHaveBeenCalled();
 expect(ExpoImage.prefetch).not.toHaveBeenCalled();
 expect(resolveDiscoveryBook).not.toHaveBeenCalled();
 expect(await prepareDiscovery(kind,[])).toEqual(cards);
});
test('publishes verified alternatives for the shared image component to handle actual errors',async()=>{
 const book={...card('primary'),coverAlternatives:[{bookId:'alternative',url:'https://art/alternative.jpg'}]};
 expect(await prepareDiscovery('alternatives',[book])).toEqual([book]);
 expect(publishCatalogCovers).toHaveBeenCalledWith({'primary':'https://art/primary.jpg'},expect.objectContaining({primary:expect.objectContaining({alternatives:['https://art/primary.jpg','https://art/alternative.jpg']})}));
});
test('bounds missing catalog lookups and retains the last good feed when resolution fails',async()=>{
 const cards=[card('cached')];
 await prepareDiscovery('missing',cards);
 expect(await prepareDiscovery('missing',Array.from({length:20},()=>({coverUrl:null})))).toEqual(cards);
 expect(resolveDiscoveryBook).toHaveBeenCalledTimes(6);
});
test('ready cached cards bypass unresolved neighbors without making identity requests',async()=>{
 const ready=card('ready');
 expect(await prepareDiscovery('mixed',[{coverUrl:null},ready,{coverUrl:null}])).toEqual([ready]);
 expect(resolveDiscoveryBook).not.toHaveBeenCalled();
});
