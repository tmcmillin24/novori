jest.mock('../src/lib/resolve-discovery-book', () => ({ resolveDiscoveryBook: jest.fn(async () => null) }));
jest.mock('react-native', () => ({ Image: { getSize: jest.fn((_url, success) => success(300,450)) } }));
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(async () => true) } }));
jest.mock('../src/lib/canonical-book-covers', () => ({ publishCatalogCovers: jest.fn() }));
jest.mock('../src/lib/moderation-media-url', () => ({ moderationMediaUrl: (url: string) => url }));
import { Image } from 'react-native';
import { prepareDiscovery } from '../src/lib/validated-discovery';
const card=(id:string)=>({coverBookId:id,coverUrl:`https://art/${id}.jpg`,coverPolicyVersion:7});
test('only verified cards with loadable portrait art are published; retains last good feed on empty refresh',async()=>{
 const good=card('good');
 expect(await prepareDiscovery('test',[good,{...card('unverified'),coverPolicyVersion:6}])).toMatchObject([good]);
 expect(await prepareDiscovery('test',[])).toMatchObject([good]);
});
test('broken images advance to a verified alternative with its matching route ID',async()=>{
 (Image.getSize as jest.Mock).mockImplementation((url,success,failure)=>url.includes('broken')?failure():success(300,450));
 const result=await prepareDiscovery('fallback',[{...card('broken'),coverAlternatives:[{bookId:'replacement',url:'https://art/replacement.jpg'}]}]);
 expect(result[0]).toMatchObject({coverBookId:'replacement',coverUrl:'https://art/replacement.jpg',rejectedCoverUrls:['https://art/broken.jpg']});
});
