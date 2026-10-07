jest.mock('../src/components/UiSheet',()=>require('./helpers/ui-sheet-mock.cjs'));
import React from 'react';
import renderer,{act} from 'react-test-renderer';
import EditClubReadScreen from '../src/app/edit-club-read';
import ClubBooksBoard from '../src/components/ClubBooksBoard';
import { getClub } from '../src/lib/clubs';
import { getClubRead,getClubReads,saveClubRead,removeClubRead } from '../src/lib/club-reads';
import { searchNovoriBooks,resolveNovoriSearchBookCover } from '../src/lib/book-search';
let mockParams={};const mockRouter={back:jest.fn(),push:jest.fn()};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useLocalSearchParams:()=>mockParams,useFocusEffect:callback=>require('react').useEffect(callback,[callback])}));
jest.mock('react-native',()=>({
 Switch:'Switch', useWindowDimensions:()=>({width:390,height:844,scale:3,fontScale:1}),
 Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},ActivityIndicator:'ActivityIndicator',Text:'Text',TextInput:'TextInput',View:'View',Pressable:'Pressable',ScrollView:'ScrollView',Modal:props=>props.visible?require('react').createElement('Modal',props,props.children):null,StyleSheet:{create:v=>v,absoluteFill:{},hairlineWidth:.5},
 Animated:{View:'AnimatedView',Value:class{setValue(){}stopAnimation(){}},parallel:()=>({start:done=>done?.({finished:true})}),timing:()=>({start:done=>done?.({finished:true})}),spring:()=>({start:done=>done?.({finished:true})})},Easing:{out:v=>v,in:v=>v,cubic:()=>{}},PanResponder:{create:()=>({panHandlers:{}})},
}));
jest.mock('react-native-keyboard-controller',()=>({KeyboardAwareScrollView:'KeyboardAwareScrollView'}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView',useSafeAreaInsets:()=>({bottom:0})}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').DARK_COLORS})}));
jest.mock('../src/components/BookCoverImage',()=> 'BookCoverImage');
jest.mock('../src/components/DeletePostConfirmSheet',()=> 'DeletePostConfirmSheet');
jest.mock('../src/lib/clubs',()=>({getClub:jest.fn()}));
jest.mock('../src/lib/club-posts',()=>({canManageClubPosts:role=>['owner','admin'].includes(role)}));
jest.mock('../src/lib/club-reads',()=>({getClubRead:jest.fn(),getClubReads:jest.fn(),saveClubRead:jest.fn(),removeClubRead:jest.fn(),newClubReadRequestKey:()=> 'stable-read-request-key'}));
jest.mock('../src/lib/book-search',()=>({searchNovoriBooks:jest.fn(),getNovoriSearchBookCover:()=> 'search-canonical-cover',getNovoriSearchBookIsbn:()=> '9781234567897',resolveNovoriSearchBookCover:jest.fn()}));
const read={id:'read-1',club_id:'club-1',book:{googleBookId:'cached-book',isbn:'9781234567897',title:'Current Book',authors:['Author'],coverUrl:'stored-cover'},status:'current',started_on:'2026-10-01',ended_on:null,note:'Read together.',updated_at:'2026-10-03T10:00:00Z'};
const lineup={current:read,upcoming:[{...read,id:'next',status:'upcoming',book:{...read.book,googleBookId:'next-book',title:'Next Book'}}],past:[{...read,id:'past',status:'past',book:{...read.book,googleBookId:'past-book',title:'Past Book'}}],upcoming_more:false,past_more:false};let view,silence;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.useFakeTimers();jest.clearAllMocks();mockParams={clubId:'club-1'};getClub.mockResolvedValue({id:'club-1',name:'Readers Club',membership_role:'owner'});getClubRead.mockResolvedValue(read);getClubReads.mockResolvedValue(lineup);saveClubRead.mockResolvedValue(read.id);removeClubRead.mockResolvedValue();searchNovoriBooks.mockResolvedValue([{id:'searched',volumeInfo:{title:'Searched Book',authors:['Author']}}]);resolveNovoriSearchBookCover.mockResolvedValue('canonical-cover');silence=jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;jest.useRealTimers();silence.mockRestore();});
async function render(element){await act(async()=>{view=renderer.create(element);});}
const button=label=>view.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel===label),field=label=>view.root.findAllByType('TextInput').find(n=>n.props.accessibilityLabel===label);
async function press(label){await act(async()=>button(label).props.onPress());}
const text=()=>view.root.findAllByType('Text').map(n=>[n.props.children].flat(Infinity).join('')).join(' ');
test('editing a club read loads the stored cover directly without search or provider resolution',async()=>{
 mockParams={clubId:'club-1',readId:read.id};await render(<EditClubReadScreen/>);expect(view.root.findByType('BookCoverImage').props.existingCoverUrl).toBe('stored-cover');await press('Club read status past');await press('Save club read');expect(saveClubRead).toHaveBeenCalledWith('club-1',expect.objectContaining({book:read.book,status:'past',started_on:read.started_on}),read,'stable-read-request-key');expect(mockRouter.back).toHaveBeenCalled();expect(searchNovoriBooks).not.toHaveBeenCalled();expect(resolveNovoriSearchBookCover).not.toHaveBeenCalled();
});
test('shared search is debounced and a new club book saves directly from its card',async()=>{
 await render(<EditClubReadScreen/>);expect(searchNovoriBooks).not.toHaveBeenCalled();await press('Choose club read book');await act(async()=>field('Club book search').props.onChangeText('Searched Book'));await act(async()=>jest.advanceTimersByTime(350));await press('Choose club book: Searched Book');await press('Save club read');expect(searchNovoriBooks).toHaveBeenCalledWith('Searched Book');expect(saveClubRead).toHaveBeenCalledWith('club-1',expect.objectContaining({status:'upcoming',started_on:null,ended_on:null,book:expect.objectContaining({googleBookId:'searched',coverUrl:'canonical-cover'})}),undefined,'stable-read-request-key');expect(mockRouter.back).toHaveBeenCalled();
});
test('missing selection and server validation use the existing warning while preserving the draft',async()=>{
 await render(<EditClubReadScreen/>);await press('Save club read');expect(text()).toContain('Choose a book');expect(saveClubRead).not.toHaveBeenCalled();await act(async()=>view.unmount());view=null;
 mockParams={clubId:'club-1',readId:read.id};saveClubRead.mockRejectedValue(new Error('This club read changed. Reload it before saving.'));await render(<EditClubReadScreen/>);await act(async()=>field('Club read note').props.onChangeText('Keep my draft'));await press('Save club read');expect(field('Club read note').props.value).toBe('Keep my draft');expect(text()).toContain('This club read changed');expect(mockRouter.back).not.toHaveBeenCalled();
});
test('reading dates are optional, can be selected on the calendar, and can be cleared',async()=>{
 mockParams={clubId:'club-1',readId:read.id};await render(<EditClubReadScreen/>);await press('Choose start date');await press('Start date 2026-10-04');await press('Clear start date');await press('Save club read');expect(saveClubRead.mock.calls[0][1].started_on).toBeNull();
});
test('ordinary members cannot open the editor controls',async()=>{
 getClub.mockResolvedValue({id:'club-1',name:'Readers',membership_role:'member'});await render(<EditClubReadScreen/>);expect(button('Save club read').props.disabled).toBe(true);expect(button('Choose club read book')).toBeUndefined();expect(saveClubRead).not.toHaveBeenCalled();
});
test('bookshelf uses one initial read, stored covers, and swipeable shelves',async()=>{
 await render(<ClubBooksBoard clubId="club-1" canManage={false}/>);expect(getClubReads).toHaveBeenCalledTimes(1);expect(view.root.findByProps({accessibilityLabel:'Upcoming club reads'}).props.horizontal).toBe(true);expect(view.root.findByProps({accessibilityLabel:'Past club reads'}).props.horizontal).toBe(true);expect(view.root.findAllByType('BookCoverImage').map(n=>n.props.existingCoverUrl)).toEqual(['stored-cover','stored-cover','stored-cover']);expect(button('Add club read')).toBeUndefined();expect(button('Options for club read: Current Book')).toBeUndefined();await press('Open club book: Next Book');expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/book/[id]',params:{id:'next-book'}});expect(searchNovoriBooks).not.toHaveBeenCalled();expect(resolveNovoriSearchBookCover).not.toHaveBeenCalled();
});
test('managers switch the current read through the existing animated action sheet',async()=>{
 await render(<ClubBooksBoard clubId="club-1" canManage/>);await press('Options for club read: Next Book');getClubReads.mockResolvedValue({...lineup,current:{...lineup.upcoming[0],status:'current'},upcoming:[],past:[read,...lineup.past]});await press('Make current read');expect(saveClubRead).toHaveBeenCalledWith('club-1',expect.objectContaining({status:'current',book:lineup.upcoming[0].book}),lineup.upcoming[0]);expect(getClubReads).toHaveBeenCalledTimes(2);expect(view.root.findAllByType('BookCoverImage')[0].props.googleBookId).toBe('next-book');
});
test('removal uses the existing animated confirmation and failures preserve the lineup',async()=>{
 await render(<ClubBooksBoard clubId="club-1" canManage/>);await press('Options for club read: Current Book');await press('Remove club read');const confirm=view.root.findByType('DeletePostConfirmSheet');expect(confirm.props.visible).toBe(true);expect(removeClubRead).not.toHaveBeenCalled();removeClubRead.mockRejectedValue(new Error('Permission changed.'));await act(async()=>confirm.props.onConfirm());expect(removeClubRead).toHaveBeenCalledWith(read);expect(button('Open club book: Current Book')).toBeDefined();expect(text()).toContain('Permission changed');
});
test('more books paginate only the requested shelf and a refresh replaces stale lineup data',async()=>{
 const page=Array.from({length:20},(_,i)=>({...read,id:'next-'+i,status:'upcoming',book:{...read.book,title:'Next '+i}}));getClubReads.mockResolvedValueOnce({...lineup,upcoming:page,upcoming_more:true}).mockResolvedValueOnce({...lineup,upcoming:[{...read,id:'last',status:'upcoming',book:{...read.book,title:'Last Book'}}],upcoming_more:false});await render(<ClubBooksBoard clubId="club-1" canManage={false}/>);await press('More upcoming club reads');expect(getClubReads).toHaveBeenLastCalledWith('club-1','upcoming',20);expect(button('Open club book: Last Book')).toBeDefined();getClubReads.mockResolvedValue({...lineup,current:null,upcoming:[],past:[]});await act(async()=>view.update(<ClubBooksBoard clubId="club-1" canManage={false} refreshVersion={1}/>));expect(button('Open club book: Last Book')).toBeUndefined();expect(button('Open club book: Current Book')).toBeUndefined();
});
