import {createReaderProfileLoad} from '../src/lib/reader-profile-loader';
import * as social from '../src/lib/social';
import {getHomeFeed} from '../src/lib/feed';
import {getMyClubs} from '../src/lib/clubs';
import {getPublicBookStacks} from '../src/lib/book-stacks';
import {getLockedVerifiedCoverUrls} from '../src/lib/user-books';
jest.mock('../src/lib/social',()=>({getReaderProfile:jest.fn(),isReaderBlockedByViewer:jest.fn(),getReaderPublicBooks:jest.fn(),getReaderPublicOwnedBooks:jest.fn(),getReaderPublicReviews:jest.fn(),getReaderPublicClubs:jest.fn(),getReaderProfilePosts:jest.fn()}));
jest.mock('../src/lib/feed',()=>({getHomeFeed:jest.fn()}));
jest.mock('../src/lib/clubs',()=>({getMyClubs:jest.fn()}));
jest.mock('../src/lib/book-stacks',()=>({getPublicBookStacks:jest.fn()}));
jest.mock('../src/lib/user-books',()=>({getLockedVerifiedCoverUrls:jest.fn()}));
const mocked=(fn:any)=>fn as jest.Mock;
const profile={id:'reader',can_view_content:true};
function handlers(){return{isCurrent:()=>true,ready:jest.fn(),library:jest.fn(),clubs:jest.fn(),managerClubs:jest.fn(),stacks:jest.fn(),activity:jest.fn(),error:jest.fn(),settled:jest.fn()};}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
let quiet:jest.SpyInstance;let info:jest.SpyInstance;
beforeEach(()=>{
 jest.clearAllMocks();quiet=jest.spyOn(console,'warn').mockImplementation(()=>{});info=jest.spyOn(console,'info').mockImplementation(()=>{});
 mocked(social.getReaderProfile).mockResolvedValue(profile);mocked(social.isReaderBlockedByViewer).mockResolvedValue(false);
 for(const fn of [social.getReaderPublicBooks,social.getReaderPublicOwnedBooks,social.getReaderPublicReviews,social.getReaderPublicClubs,social.getReaderProfilePosts,getHomeFeed,getMyClubs,getPublicBookStacks])mocked(fn).mockResolvedValue([]);
 mocked(getLockedVerifiedCoverUrls).mockResolvedValue(new Map());
});
afterEach(()=>{quiet.mockRestore();info.mockRestore();});
test('profile becomes ready before slow library sections; opening profile never fetches the home feed',async()=>{
 const books=deferred<any[]>();mocked(social.getReaderPublicBooks).mockReturnValue(books.promise);
 const h=handlers(),load=createReaderProfileLoad('reader',h);await load.ready;
 expect(h.ready).toHaveBeenCalledWith(profile,false);expect(h.library).not.toHaveBeenCalled();expect(getHomeFeed).not.toHaveBeenCalled();expect(social.getReaderProfilePosts).not.toHaveBeenCalled();
 books.resolve([]);await load.finished;expect(h.library).toHaveBeenCalled();
});
test('library keeps verified cover corrections without waiting for activity',async()=>{
 const book={id:'entry',google_book_id:'book',title:'Book',cover_url:'old',status:'reading'};
 mocked(social.getReaderPublicBooks).mockResolvedValue([book]);mocked(getLockedVerifiedCoverUrls).mockResolvedValue(new Map([['book','verified']]));
 const h=handlers();await createReaderProfileLoad('reader',h).finished;
 expect(h.library.mock.calls[0][0][0].cover_url).toBe('verified');expect(getHomeFeed).not.toHaveBeenCalled();
});
test.each([true,false])('blocked/private content stays behind the profile checks (blocked=%s)',async blocked=>{
 mocked(social.isReaderBlockedByViewer).mockResolvedValue(blocked);mocked(social.getReaderProfile).mockResolvedValue({...profile,can_view_content:blocked});
 const h=handlers(),load=createReaderProfileLoad('reader',h);await load.finished;await load.loadActivity();
 expect(social.getReaderPublicBooks).not.toHaveBeenCalled();expect(getHomeFeed).not.toHaveBeenCalled();
});
test('activity loads on demand once, preserves shared-club filtering and deduplicates posts',async()=>{
 mocked(getMyClubs).mockResolvedValue([{id:'shared',membership_role:'member'}]);
 mocked(social.getReaderProfilePosts).mockResolvedValue([{id:'one',author_id:'reader',club_id:'shared',created_at:'2026-11-01'},{id:'hidden',club_id:'not-shared'}]);
 mocked(getHomeFeed).mockResolvedValue([{id:'one',author_id:'reader',club_id:'shared',created_at:'2026-11-01'},{id:'other',author_id:'other'}]);
 const h=handlers(),load=createReaderProfileLoad('reader',h);await load.finished;
 await Promise.all([load.loadActivity(),load.loadActivity()]);
 expect(getHomeFeed).toHaveBeenCalledTimes(1);expect(h.activity.mock.calls[0][0].map((p:any)=>p.id)).toEqual(['one']);
});
test('cancelled reader requests cannot update the next reader or fetch more sections',async()=>{
 const pending=deferred<any>();mocked(social.getReaderProfile).mockReturnValue(pending.promise);
 const h=handlers();let current=true;h.isCurrent=()=>current;
 const load=createReaderProfileLoad('reader',h);current=false;pending.resolve(profile);await load.finished;
 expect(h.ready).not.toHaveBeenCalled();expect(social.getReaderPublicBooks).not.toHaveBeenCalled();
});
test('a failed secondary section does not replace the profile with a full-screen error',async()=>{
 mocked(getPublicBookStacks).mockRejectedValue(new Error('offline'));
 const h=handlers();await createReaderProfileLoad('reader',h).finished;
 expect(h.ready).toHaveBeenCalled();expect(h.library).toHaveBeenCalled();expect(h.error).toHaveBeenCalledWith('stacks');expect(h.settled).toHaveBeenCalledWith('stacks');
});

test('late library and cover responses are discarded after leaving the profile',async()=>{
 const pending=deferred<Map<string,string>>();mocked(getLockedVerifiedCoverUrls).mockReturnValue(pending.promise);
 const h=handlers();let current=true;h.isCurrent=()=>current;
 const load=createReaderProfileLoad('reader',h);await load.ready;await Promise.resolve();await Promise.resolve();current=false;
 pending.resolve(new Map());await load.finished;
 expect(h.library).not.toHaveBeenCalled();
});
