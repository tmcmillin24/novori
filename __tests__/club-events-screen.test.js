import React from 'react';
import renderer,{act} from 'react-test-renderer';
import CreateClubEventScreen from '../src/app/create-club-event';
import ClubEventScreen from '../src/app/club-event/[id]';
import ClubEventsBoard from '../src/components/ClubEventsBoard';
import { getClub } from '../src/lib/clubs';
import { getClubEvent,getClubEvents,saveClubEvent,setClubEventRsvp,cancelClubEvent } from '../src/lib/club-events';
import { getClubPins,setClubPostPin } from '../src/lib/club-posts';
import { getPostDetail } from '../src/lib/feed';
import { searchNovoriBooks,resolveNovoriSearchBookCover } from '../src/lib/book-search';

let mockParams={};const mockRouter={back:jest.fn(),push:jest.fn(),replace:jest.fn()};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useLocalSearchParams:()=>mockParams,useFocusEffect:callback=>require('react').useEffect(callback,[callback])}));
jest.mock('react-native',()=>({
  Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},ActivityIndicator:'ActivityIndicator',Text:'Text',TextInput:'TextInput',View:'View',Pressable:'Pressable',ScrollView:'ScrollView',RefreshControl:'RefreshControl',
  Modal:props=>props.visible?require('react').createElement('Modal',props,props.children):null,
  Linking:{openURL:jest.fn()},AppState:{addEventListener:()=>({remove:()=>{}})},StyleSheet:{create:v=>v,absoluteFill:{},hairlineWidth:.5},
  Animated:{View:'AnimatedView',Value:class{setValue(){}stopAnimation(){}},parallel:()=>({start:done=>done?.({finished:true})}),timing:()=>({start:done=>done?.({finished:true})}),spring:()=>({start:done=>done?.({finished:true})})},
  Easing:{out:v=>v,in:v=>v,cubic:()=>{}},PanResponder:{create:()=>({panHandlers:{}})},
}));
jest.mock('react-native-keyboard-controller',()=>({KeyboardAwareScrollView:'KeyboardAwareScrollView'}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView',useSafeAreaInsets:()=>({bottom:0})}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').DARK_COLORS})}));
jest.mock('../src/components/BookCoverImage',()=> 'BookCoverImage');
jest.mock('../src/components/DeletePostConfirmSheet',()=> 'DeletePostConfirmSheet');
jest.mock('../src/lib/clubs',()=>({getClub:jest.fn()}));
jest.mock('../src/lib/club-events',()=>({CLUB_EVENTS_PAGE_SIZE:20,getClubEvents:jest.fn(),getClubEvent:jest.fn(),saveClubEvent:jest.fn(),setClubEventRsvp:jest.fn(),cancelClubEvent:jest.fn(),newClubEventRequestKey:()=> 'stable-event-request-key'}));
jest.mock('../src/lib/feed',()=>({getPostDetail:jest.fn()}));
jest.mock('../src/lib/club-posts',()=>({canManageClubPosts:role=>['owner','admin'].includes(role),getClubPins:jest.fn(),setClubPostPin:jest.fn(),resolveClubPinnedPosts:async()=>[],MAX_CLUB_PINS:3}));
jest.mock('../src/lib/book-search',()=>({searchNovoriBooks:jest.fn(),getNovoriSearchBookCover:()=> 'search-canonical-cover',getNovoriSearchBookIsbn:()=> '9781234567897',resolveNovoriSearchBookCover:jest.fn()}));
const event={id:'event-1',post_id:'event-post',club_id:'club-1',title:'Friday Readers',description:'A good conversation.',starts_at:'2099-06-01T23:00:00Z',ends_at:'2099-06-02T01:00:00Z',timezone:'America/Chicago',kind:'in_person',location:'Cafe',meeting_url:null,book:{googleBookId:'cached-book',isbn:'9781234567897',title:'Book',authors:['Author'],coverUrl:'stored-cover'},cancelled_at:null,going_count:0,maybe_count:0,viewer_rsvp:null,updated_at:'2026-10-03T10:00:00Z'};
const club={id:'club-1',name:'Readers Club',privacy:'public',membership_role:'owner'};let view,silence;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.useFakeTimers();jest.clearAllMocks();mockParams={clubId:'club-1'};
 getClub.mockResolvedValue(club);getClubEvent.mockResolvedValue(event);getClubEvents.mockResolvedValue([]);saveClubEvent.mockResolvedValue('event-1');setClubEventRsvp.mockImplementation(async(_,status)=>({...event,viewer_rsvp:status,going_count:status==='going'?1:0}));cancelClubEvent.mockResolvedValue();
 getClubPins.mockResolvedValue([]);setClubPostPin.mockResolvedValue();getPostDetail.mockResolvedValue({id:'event-post',club_id:'club-1',body:'A good conversation.',club_event:event});
 searchNovoriBooks.mockResolvedValue([{id:'searched-book',volumeInfo:{title:'Searched Book',authors:['Author']}}]);resolveNovoriSearchBookCover.mockResolvedValue('resolved-canonical-cover');silence=jest.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;jest.useRealTimers();silence.mockRestore();});
async function render(element){await act(async()=>{view=renderer.create(element);});}
const button=label=>view.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel===label);
const field=label=>view.root.findAllByType('TextInput').find(n=>n.props.accessibilityLabel===label);
async function press(label){await act(async()=>button(label).props.onPress());}
async function fill(label,value){await act(async()=>field(label).props.onChangeText(value));}
const text=()=>view.root.findAllByType('Text').map(n=>[n.props.children].flat(Infinity).join('')).join(' ');
test('manager creates an event directly from its card with no confirmation or book request',async()=>{
 await render(<CreateClubEventScreen/>);await fill('Event title','Friday Readers');await fill('Event location','Cafe');await press('Save club event');
 expect(saveClubEvent).toHaveBeenCalledTimes(1);expect(saveClubEvent).toHaveBeenCalledWith('club-1',expect.objectContaining({title:'Friday Readers',kind:'in_person',location:'Cafe',book:null}),undefined,'stable-event-request-key');
 expect(mockRouter.replace).toHaveBeenCalledWith({pathname:'/club-event/[id]',params:{id:'event-1'}});expect(searchNovoriBooks).not.toHaveBeenCalled();
});
test('event editor preserves cached book data while editing and allows virtual details',async()=>{
 mockParams={clubId:'club-1',eventId:'event-1'};await render(<CreateClubEventScreen/>);expect(field('Event title').props.value).toBe(event.title);expect(view.root.findByType('BookCoverImage').props.existingCoverUrl).toBe('stored-cover');
 await press('Virtual event');await fill('Event meeting link','https://meet.example.com');await press('Save club event');expect(saveClubEvent).toHaveBeenCalledWith('club-1',expect.objectContaining({kind:'virtual',meeting_url:'https://meet.example.com',book:event.book}),event,'stable-event-request-key');
 expect(searchNovoriBooks).not.toHaveBeenCalled();expect(resolveNovoriSearchBookCover).not.toHaveBeenCalled();expect(mockRouter.back).toHaveBeenCalled();
});
test('book search uses the shared search only after input and stores canonical identity on selection',async()=>{
 await render(<CreateClubEventScreen/>);await press('Choose event book');await fill('Event book search','Searched Book');await act(async()=>jest.advanceTimersByTime(350));await press('Choose book: Searched Book');
 expect(searchNovoriBooks).toHaveBeenCalledWith('Searched Book');expect(view.root.findByType('BookCoverImage').props.googleBookId).toBe('searched-book');expect(view.root.findByType('BookCoverImage').props.existingCoverUrl).toBe('resolved-canonical-cover');
});
test('calendar date selection and time fields remain in the editable card',async()=>{
 await render(<CreateClubEventScreen/>);await press('Choose start date');expect(button('Next start month')).toBeDefined();await fill('Start hour','7');await fill('Start minute','30');await press('Start PM');
 expect(field('Start hour').props.value).toBe('7');expect(field('Start minute').props.value).toBe('30');
});
test('members cannot edit events and validation failures retain the draft',async()=>{
 getClub.mockResolvedValue({...club,membership_role:'member'});await render(<CreateClubEventScreen/>);expect(button('Save club event').props.disabled).toBe(true);expect(field('Event title')).toBeUndefined();
 await act(async()=>view.unmount());view=null;getClub.mockResolvedValue(club);saveClubEvent.mockRejectedValue(new Error('Choose a future start time.'));await render(<CreateClubEventScreen/>);await fill('Event title','Keep this draft');await press('Save club event');
 expect(text()).toContain('Choose a future start time.');expect(field('Event title').props.value).toBe('Keep this draft');expect(mockRouter.replace).not.toHaveBeenCalled();
});
test('member RSVP can be changed or cleared and reflects confirmed counts',async()=>{
 mockParams={id:'event-1'};getClub.mockResolvedValue({...club,membership_role:'member'});await render(<ClubEventScreen/>);await press('RSVP Going');expect(setClubEventRsvp).toHaveBeenLastCalledWith('event-1','going');expect(button('RSVP Going').props.accessibilityState.selected).toBe(true);
 await press('RSVP Going');expect(setClubEventRsvp).toHaveBeenLastCalledWith('event-1',null);expect(button('RSVP Going').props.accessibilityState.selected).toBe(false);expect(button('Open event options')).toBeUndefined();
});
test('visitors can view public events but cannot RSVP; cancelled events close responses',async()=>{
 mockParams={id:'event-1'};getClub.mockResolvedValue({...club,membership_role:null});await render(<ClubEventScreen/>);expect(button('RSVP Going')).toBeUndefined();expect(text()).toContain('Join this club to RSVP.');
 await act(async()=>view.unmount());view=null;getClub.mockResolvedValue(club);getClubEvent.mockResolvedValue({...event,cancelled_at:'2026-10-03T10:00Z'});await render(<ClubEventScreen/>);expect(button('RSVP Going').props.disabled).toBe(true);expect(button('Open event options')).toBeUndefined();expect(text()).toContain('CANCELLED');
});
test('event options use manager editor, pin picker, and cancellation confirmation',async()=>{
 mockParams={id:'event-1'};await render(<ClubEventScreen/>);await press('Open event options');await press('Edit event');expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/create-club-event',params:{clubId:'club-1',eventId:'event-1'}});
 await press('Open event options');await press('Pin options');await press('Pin post');expect(setClubPostPin).toHaveBeenCalledWith('club-1','event-post',true,undefined);
 await press('Open event options');await press('Cancel event');const confirm=view.root.findByType('DeletePostConfirmSheet');expect(confirm.props.visible).toBe(true);expect(confirm.props.confirmLabel).toBe('Cancel event');getClubEvent.mockResolvedValue({...event,cancelled_at:'2026-10-03T10:00Z'});
 await act(async()=>confirm.props.onConfirm());expect(cancelClubEvent).toHaveBeenCalledWith('event-1');expect(text()).toContain('CANCELLED');expect(button('View event discussion')).toBeDefined();
});
test('past events paginate and all cancelled entries remain accessible',async()=>{
 const page=Array.from({length:20},(_,i)=>({...event,id:'past-'+i,title:'Past '+i,cancelled_at:'2026-10-03'}));getClubEvents.mockResolvedValueOnce(page).mockResolvedValueOnce([{...event,id:'past-20',title:'Past 20',cancelled_at:'2026-10-03'}]);
 await render(<ClubEventsBoard clubId="club-1" upcoming={[]} canManage={false} now={Date.now()}/>);await press('Past club events');expect(button('Open event: Past 0')).toBeDefined();await press('Load more club events');expect(getClubEvents).toHaveBeenLastCalledWith('club-1','past',20);expect(button('Open event: Past 20')).toBeDefined();expect(button('Create club event')).toBeUndefined();
});
