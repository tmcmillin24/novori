jest.mock('../src/lib/dismiss-keyboard-before-warning',()=>({dismissKeyboardBeforeWarning:jest.fn().mockResolvedValue(undefined)}));
jest.mock('../src/components/UiSheet',()=>require('./helpers/ui-sheet-mock.cjs'));
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import EditClubScreen from '../src/app/edit-club';
import CreateClubScreen from '../src/app/create-club';
import ClubDetailScreen from '../src/app/club/[id]';
import ClubHomeCard from '../src/components/ClubHomeCard';
import ClubOptionsSheet from '../src/components/ClubOptionsSheet';
import NotificationSettingsScreen from '../src/app/notification-settings';
import {getClubMemberExperience,setClubNotificationsEnabled,dismissClubWelcome} from '../src/lib/club-member-experience';
import {getNotificationPreferences,updateNotificationPreference} from '../src/lib/notifications';
import { getClub, getClubMembers, getPendingClubInvitesForManager, updateClub, createClub } from '../src/lib/clubs';
import { getClubPosts } from '../src/lib/feed';
import { getClubEvents } from '../src/lib/club-events';
import { getClubReads } from '../src/lib/club-reads';
import { getClubConversation, getClubPins, setClubPostPin } from '../src/lib/club-posts';

const mockRouter={push:jest.fn(),back:jest.fn(),replace:jest.fn()};
let mockClubParams={id:'club-1',clubId:'club-1'};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useLocalSearchParams:()=>mockClubParams,useFocusEffect:callback=>require('react').useEffect(callback,[callback])}));
jest.mock('react-native',()=>({
  useWindowDimensions:()=>({width:390,height:844}),KeyboardAvoidingView:'KeyboardAvoidingView',Text:'Text',View:'View',Pressable:'Pressable',Image:'Image',TextInput:'TextInput',ActivityIndicator:'ActivityIndicator',RefreshControl:'RefreshControl',Switch:'Switch',
  AppState:{addEventListener:()=>({remove:()=>{}})},Alert:{alert:jest.fn()},Keyboard:{dismiss:jest.fn()},Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},
  Modal:props=>props.visible?require('react').createElement('Modal',props,props.children):null,
  ScrollView:require('react').forwardRef((props,ref)=>{require('react').useImperativeHandle(ref,()=>({scrollTo:jest.fn()}),[]);return require('react').createElement('ScrollView',props,props.children);}),
  Animated:{View:'AnimatedView',Value:class {setValue(){}stopAnimation(){}interpolate(){return 0;}},
    parallel:()=>({start:done=>done?.({finished:true})}),timing:()=>({start:done=>done?.({finished:true})}),spring:()=>({start:done=>done?.({finished:true})})},
  Easing:{out:v=>v,in:v=>v,cubic:()=>{}},PanResponder:{create:()=>({panHandlers:{}})},StyleSheet:{create:v=>v,absoluteFill:{},hairlineWidth:.5},
}));
jest.mock('expo-image-picker',()=>({}));
jest.mock('../src/components/ClubPhotoCropper',()=> 'ClubPhotoCropper');
jest.mock('../src/components/PhotoSourceSheet',()=> 'PhotoSourceSheet');
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView',useSafeAreaInsets:()=>({bottom:0,top:0})}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').DARK_COLORS})}));
jest.mock('../src/components/BookCoverImage',()=> 'BookCoverImage');
jest.mock('../src/components/FeedPostImage',()=> 'FeedPostImage');
jest.mock('../src/components/FullScreenImageViewer',()=> 'FullScreenImageViewer');
jest.mock('../src/components/BlockReaderConfirmSheet',()=> 'BlockReaderConfirmSheet');
jest.mock('../src/components/LeaveClubConfirmSheet',()=> 'LeaveClubConfirmSheet');
jest.mock('../src/components/PostTypeIdentifier',()=> 'PostTypeIdentifier');
jest.mock('../src/components/ReadingReminderSettings',()=> 'ReadingReminderSettings');
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:async()=>null,setItem:async()=>{}}));
jest.mock('../src/lib/club-member-experience',()=>({getClubMemberExperience:jest.fn(),setClubNotificationsEnabled:jest.fn(),dismissClubWelcome:jest.fn()}));
jest.mock('../src/lib/notifications',()=>({getNotificationPreferences:jest.fn(),updateNotificationPreference:jest.fn()}));
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:'owner'}}})}}}));
jest.mock('../src/lib/clubs',()=>({updateClub:jest.fn(),createClub:jest.fn(),uploadClubCover:jest.fn(),getClub:jest.fn(),getClubMembers:jest.fn(),getPendingClubInvite:async()=>null,getPendingPrivateClubRequest:async()=>null,
  getPendingClubInvitesForManager:jest.fn(),getPendingClubJoinRequestsForManager:async()=>[],searchClubInviteCandidates:jest.fn()}));
jest.mock('../src/lib/feed',()=>({getClubPosts:jest.fn()}));
jest.mock('../src/lib/club-events',()=>({getClubEvents:jest.fn(),CLUB_EVENTS_PAGE_SIZE:20}));
jest.mock('../src/lib/club-reads',()=>({getClubReads:jest.fn()}));
jest.mock('../src/lib/club-posts',()=>({MAX_CLUB_PINS:3,getClubConversation:jest.fn(),getClubPins:jest.fn(),setClubPostPin:jest.fn(),resolveClubPinnedPosts:async(club,pins,posts)=>pins.flatMap(pin=>{const post=posts.find(p=>p.id===pin.post_id);return post?[post]:[];})}));
jest.mock('../src/lib/reports',()=>({}));jest.mock('../src/lib/social',()=>({}));jest.mock('../src/lib/share-links',()=>({shareClubLink:jest.fn(async()=>{})}));
const base={id:'club-1',owner_id:'owner',name:'Readers Club',description:'A home for good books.',privacy:'public',genres:[],cover_url:'club-photo.jpg',rules:'Be kind.\nLabel spoilers.',member_count:2,membership_role:'owner'};
let view,silence;
const experience={notifications_enabled:true,global_notifications_enabled:true,welcome_seen_at:'2026-10-03T19:00:00Z',current_read_id:'read-1',current_read_title:'Stored shared read'};
const notificationPrefs={club_activity:true,club_invites:true,new_followers:true,reactions_and_replies:true,reading_started:false,reading_finished:false};
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.clearAllMocks();getClub.mockResolvedValue(base);
  mockClubParams={id:'club-1',clubId:'club-1'};
  getClubMemberExperience.mockResolvedValue(experience);setClubNotificationsEnabled.mockImplementation(async(_,enabled)=>({...experience,notifications_enabled:enabled}));dismissClubWelcome.mockResolvedValue(experience);getNotificationPreferences.mockResolvedValue(notificationPrefs);updateNotificationPreference.mockImplementation(async(key,enabled)=>({...notificationPrefs,[key]:enabled}));
  getClubReads.mockResolvedValue({current:null,upcoming:[],past:[],upcoming_more:false,past_more:false});
  getClubMembers.mockResolvedValue([{user_id:'owner',role:'owner',display_name:'Founder Person',username:'owner',avatar_url:null},{user_id:'member',role:'member',display_name:'Member Reader',username:'member',avatar_url:null}]);
  updateClub.mockResolvedValue(base);createClub.mockResolvedValue(base);getClubPosts.mockResolvedValue([]);getClubEvents.mockResolvedValue([]);getClubConversation.mockImplementation(async()=>({posts:await getClubPosts(),pinnedPosts:[]}));getClubPins.mockResolvedValue([]);setClubPostPin.mockResolvedValue();getPendingClubInvitesForManager.mockResolvedValue([]);silence=jest.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;silence.mockRestore();});
async function render(element=<ClubDetailScreen/>){await act(async()=>{view=renderer.create(element);});}
function text(){return view.root.findAllByType('Text').map(node=>[node.props.children].flat(Infinity).join('')).join(' ');}
function button(label){return view.root.findAllByType('Pressable').find(node=>node.props.accessibilityLabel===label);}
async function press(label){await act(async()=>button(label).props.onPress());}
test('club home keeps management and member lists compact until opened',async()=>{
  await render();expect(view.root.findAllByType(ClubHomeCard)).toHaveLength(1);expect(text()).toContain('Club conversation');expect(text()).not.toContain('Founder Person');
  expect(button('Open club options')).toBeDefined();expect(button('Edit club')).toBeUndefined();
  expect(getClubMembers).toHaveBeenCalledTimes(1);expect(getClubPosts).toHaveBeenCalledTimes(1);
});
test('owner ellipsis menu opens the existing owner editor directly',async()=>{
  await render();await press('Open club options');expect(button('Edit club')).toBeDefined();expect(button('Leave club')).toBeUndefined();
  await press('Edit club');expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/edit-club',params:{clubId:'club-1'}});
  expect(view.root.findByType(ClubOptionsSheet).props.visible).toBe(false);
});
test('admin has management and leave actions but no owner editing',async()=>{
  getClub.mockResolvedValue({...base,membership_role:'admin'});await render();await press('Open club options');
  expect(button('Edit club')).toBeUndefined();expect(button('Manage members & invitations')).toBeDefined();expect(button('Leave club')).toBeDefined();
  await press('Manage members & invitations');expect(text()).toContain('Invite Readers');expect(text()).toContain('Founder Person');
});
test('ordinary member menu uses the existing animated leave confirmation',async()=>{
  getClub.mockResolvedValue({...base,membership_role:'member'});await render();await press('Open club options');
  expect(button('Edit club')).toBeUndefined();expect(button('Manage members & invitations')).toBeUndefined();await press('Leave club');
  expect(view.root.findByType('LeaveClubConfirmSheet').props.visible).toBe(true);
});
test('rules expand in the home card and remain owner-editable',async()=>{
  await render();expect(text()).not.toContain('Label spoilers.');await press('View club rules');expect(text()).toContain('Label spoilers.');expect(button('Edit club rules')).toBeDefined();
  await press('Edit club rules');expect(mockRouter.push.mock.calls[0][0].pathname).toBe('/edit-club');
});
test('private visitors see rules but no members, posts or management actions',async()=>{
  getClub.mockResolvedValue({...base,privacy:'private',membership_role:null});await render();
  expect(getClubMembers).not.toHaveBeenCalled();expect(getClubPosts).not.toHaveBeenCalled();expect(getClubEvents).not.toHaveBeenCalled();expect(getPendingClubInvitesForManager).not.toHaveBeenCalled();
  expect(getClubReads).not.toHaveBeenCalled();expect(button('Club Books tab')).toBeUndefined();
  await press('Open club options');expect(button('Members')).toBeUndefined();expect(button('Edit club')).toBeUndefined();expect(button('Manage members & invitations')).toBeUndefined();
  await press('Club rules');expect(text()).toContain('Label spoilers.');expect(button('Edit club rules')).toBeUndefined();
});
test('members open on demand and require no additional requests',async()=>{
  await render();await press('View club members');expect(text()).toContain('Member Reader');expect(getClubMembers).toHaveBeenCalledTimes(1);
  await press('Hide club members');expect(text()).not.toContain('Member Reader');
});
test('owner can add missing rules; visitors see no empty rules placeholder',async()=>{
  getClub.mockResolvedValue({...base,rules:''});await render();await press('View club rules');expect(button('Edit club rules')).toBeDefined();
  await act(async()=>view.unmount());view=null;getClub.mockResolvedValue({...base,rules:'',membership_role:null});await render();expect(button('View club rules')).toBeUndefined();
});
test('long descriptions can expand and the existing club photo URL is preserved',async()=>{
  getClub.mockResolvedValue({...base,description:'A welcoming club. '.repeat(30)});await render();await press('Read full club description');expect(button('Show less club description')).toBeDefined();
  expect(view.root.findAllByType('Image').some(node=>node.props.source?.uri==='club-photo.jpg')).toBe(true);
});

test('owner editor loads, edits, and clears saved rules through the existing save',async()=>{
  await render(<EditClubScreen/>);const input=view.root.findAllByType('TextInput').find(node=>node.props.accessibilityLabel==='Club rules');
  expect(input.props.value).toBe(base.rules);await act(async()=>input.props.onChangeText('  Welcome.\nLabel spoilers.  '));await press('Save club changes');
  expect(updateClub).toHaveBeenCalledWith('club-1',expect.objectContaining({rules:'Welcome.\nLabel spoilers.'}));expect(mockRouter.back).toHaveBeenCalled();
  await act(async()=>view.root.findAllByType('TextInput').find(node=>node.props.accessibilityLabel==='Club rules').props.onChangeText(''));await press('Save club changes');
  expect(updateClub.mock.calls[1][1].rules).toBe('');
});
test('creating a club includes optional rules without a separate save flow',async()=>{
  await render(<CreateClubScreen/>);const inputs=view.root.findAllByType('TextInput');
  await act(async()=>{inputs.find(node=>node.props.accessibilityLabel==='Club name').props.onChangeText('New Readers');inputs.find(node=>node.props.accessibilityLabel==='Club rules').props.onChangeText(' Be kind. ');});
  await press('Create club');expect(createClub).toHaveBeenCalledWith(expect.objectContaining({name:'New Readers',rules:'Be kind.'}));
});

const postFixture={id:'post-1',author_id:'owner',club_id:'club-1',post_type:'post',body:'Next meeting on Friday.',book_title:null,author_display_name:'Founder Person',created_at:new Date().toISOString(),comment_count:0,vote_score:0,viewer_vote:0,is_club_announcement:true};
test('manager can start an announcement and pin an existing post',async()=>{
  getClubConversation.mockResolvedValue({posts:[postFixture],pinnedPosts:[]});getClubPins.mockResolvedValue([{post_id:'post-1'}]);
  await render();await press('Create club announcement');expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/create-post',params:{clubId:'club-1',announcement:'1'}});
  await press('Pin options: post-1');await press('Pin post');expect(setClubPostPin).toHaveBeenCalledWith('club-1','post-1',true,undefined);
  expect(text()).toContain('PINNED');expect(button('Open pinned post: Next meeting on Friday.')).toBeDefined();
});
test('full pin picker replaces a chosen post and unpin uses the same animation',async()=>{
  const pins=[1,2,3].map(i=>({...postFixture,id:'old-'+i,body:'Old pin '+i}));getClubConversation.mockResolvedValue({posts:[postFixture],pinnedPosts:pins});
  getClubPins.mockResolvedValue([{post_id:'old-1'},{post_id:'old-3'},{post_id:'post-1'}]);await render();
  await press('Pin options: post-1');expect(button('Pin post')).toBeUndefined();await press('Replace: Old pin 2');
  expect(setClubPostPin).toHaveBeenCalledWith('club-1','post-1',true,'old-2');
  await press('Manage pin: post-1');getClubPins.mockResolvedValue([]);await press('Unpin post');
  expect(setClubPostPin).toHaveBeenLastCalledWith('club-1','post-1',false,undefined);expect(text()).not.toContain('PINNED');
});
test('members can open old pinned posts but have no announcement or pin controls',async()=>{
  getClub.mockResolvedValue({...base,membership_role:'member'});getClubConversation.mockResolvedValue({posts:[],pinnedPosts:[postFixture]});
  await render();expect(button('Create club announcement')).toBeUndefined();expect(button('Manage pin: post-1')).toBeUndefined();
  await press('Open pinned post: Next meeting on Friday.');expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/post/[id]',params:{id:'post-1'}});
});
test('pin failures preserve the visible pins',async()=>{
  getClubConversation.mockResolvedValue({posts:[postFixture],pinnedPosts:[postFixture]});setClubPostPin.mockRejectedValue(new Error('Permission changed.'));
  await render();await press('Pin options: post-1');await press('Unpin post');expect(text()).toContain('PINNED');expect(getClubPins).not.toHaveBeenCalled();
});

test('large member lists scroll inside the card while small clubs stay natural height',async()=>{
  getClubMembers.mockResolvedValue(Array.from({length:50},(_,i)=>({user_id:'reader-'+i,role:i===0?'owner':'member',display_name:'Reader '+i,username:'reader'+i})));
  await render();await press('View club members');let scroll=view.root.findByProps({accessibilityLabel:'Club members'});
  expect(scroll.props.nestedScrollEnabled).toBe(true);expect(scroll.props.scrollEnabled).toBe(true);expect(scroll.props.style.maxHeight).toBe(344);
  expect(text()).toContain('Swipe to see all members');expect(text()).not.toContain('Show 49 more');expect(getClubMembers).toHaveBeenCalledTimes(1);
  await act(async()=>view.unmount());view=null;getClubMembers.mockResolvedValue([{user_id:'owner',role:'owner',display_name:'Founder Person'}]);
  await render();await press('View club members');scroll=view.root.findByProps({accessibilityLabel:'Club members'});
  expect(scroll.props.scrollEnabled).toBe(false);expect(scroll.props.style).toBeUndefined();expect(text()).not.toContain('Swipe to see all members');
});

test('club tabs keep posts and events separate and managers can create events',async()=>{
  await render();await press('Club Events tab');expect(button('Create club event')).toBeDefined();expect(button('Create club announcement')).toBeDefined();
  await press('Create club event');expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/create-club-event',params:{clubId:'club-1'}});
  await press('Club Posts tab');expect(button('Create club announcement')).toBeDefined();expect(getClubEvents).toHaveBeenCalledTimes(1);
});
test('books tab loads the shared lineup only when opened and provides manager controls',async()=>{
  await render();expect(getClubReads).not.toHaveBeenCalled();await press('Club Books tab');expect(getClubReads).toHaveBeenCalledTimes(1);
  expect(button('Add club read')).toBeDefined();expect(button('Create club announcement')).toBeDefined();expect(button('Create club event')).toBeUndefined();
  await press('Choose current club read');expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/edit-club-read',params:{clubId:'club-1',status:'current'}});
});

test('member club menu persists mute/unmute and exposes global settings without moving tab actions',async()=>{
  getClub.mockResolvedValue({...base,membership_role:'member'});await render();await press('Open club options');await press('Mute club notifications');expect(setClubNotificationsEnabled).toHaveBeenCalledWith('club-1',false);await press('Open club options');expect(text()).toContain('This club is muted.');await press('Unmute club notifications');expect(setClubNotificationsEnabled).toHaveBeenLastCalledWith('club-1',true);await press('Open club options');await press('Notification settings');expect(mockRouter.push).toHaveBeenCalledWith('/notification-settings');expect(button('Club Posts tab')).toBeDefined();
});
test('global off is shown in club menu and unmuting preserves global off',async()=>{
  getClubMemberExperience.mockResolvedValue({...experience,notifications_enabled:false,global_notifications_enabled:false});setClubNotificationsEnabled.mockResolvedValue({...experience,global_notifications_enabled:false});await render();await press('Open club options');expect(text()).toContain('Club notifications are off in Settings.');await press('Unmute club notifications');await press('Open club options');expect(text()).toContain('Club notifications are off in Settings.');expect(button('Mute club notifications')).toBeDefined();
});
test('failed mute keeps the previous preference and shows the app warning sheet',async()=>{
  setClubNotificationsEnabled.mockRejectedValue(new Error('Connection lost.'));await render();await press('Open club options');await press('Mute club notifications');expect(text()).toContain('Connection lost.');await press('Open club options');expect(button('Mute club notifications')).toBeDefined();expect(button('Unmute club notifications')).toBeUndefined();
});
test('new member sees stored read guidance, can dismiss it permanently, and reopen it',async()=>{
  getClubMemberExperience.mockResolvedValue({...experience,welcome_seen_at:null});await render();expect(text()).toContain('MAKE YOURSELF AT HOME');expect(text()).toContain('Stored shared read');expect(getClubReads).not.toHaveBeenCalled();await press('Read welcome club rules');expect(text()).toContain('Label spoilers.');await press('Join the discussion');expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/club-discussions',params:{clubId:'club-1'}});await press('Dismiss club welcome');expect(dismissClubWelcome).toHaveBeenCalledWith('club-1');expect(text()).not.toContain('MAKE YOURSELF AT HOME');await press('Open club options');await press('Club guide');expect(text()).toContain('MAKE YOURSELF AT HOME');await press('Explore club books');expect(getClubReads).toHaveBeenCalledTimes(1);
});
test('private visitor never reads member preferences or sees mute/guide controls',async()=>{
  getClub.mockResolvedValue({...base,privacy:'private',membership_role:null});await render();expect(getClubMemberExperience).not.toHaveBeenCalled();await press('Open club options');expect(button('Mute club notifications')).toBeUndefined();expect(button('Club guide')).toBeUndefined();
});
test('club preferences failure does not hide the club and next attempt can save',async()=>{
  getClubMemberExperience.mockRejectedValueOnce(new Error('Preferences unavailable.'));await render();expect(text()).toContain('Club conversation');await press('Open club options');await press('Mute club notifications');expect(setClubNotificationsEnabled).toHaveBeenCalledWith('club-1',false);
});
test('master club notifications switch is on by default, saves server preference, and rolls back failures',async()=>{
  await render(<NotificationSettingsScreen/>);const control=()=>view.root.findAllByType('Switch').find(n=>n.props.accessibilityLabel==='Club Notifications');expect(control().props.value).toBe(true);await act(async()=>control().props.onValueChange(false));expect(updateNotificationPreference).toHaveBeenCalledWith('club_activity',false);expect(control().props.value).toBe(false);updateNotificationPreference.mockRejectedValue(new Error('Offline'));await act(async()=>control().props.onValueChange(true));expect(control().props.value).toBe(false);
});
test('opening a welcome notification shows the guide once and dismissing survives refresh',async()=>{
  mockClubParams={id:'club-1',clubId:'club-1',guide:'1'};await render();expect(text()).toContain('MAKE YOURSELF AT HOME');await press('Dismiss club welcome');await act(async()=>view.root.findAllByType('ScrollView').find(n=>n.props.refreshControl).props.refreshControl.props.onRefresh());expect(text()).not.toContain('MAKE YOURSELF AT HOME');
});
test('guide can recover from a failed preference load without changing mute or welcome state',async()=>{
  getClubMemberExperience.mockRejectedValueOnce(new Error('Temporary outage.'));await render();await press('Open club options');await press('Club guide');expect(text()).toContain('MAKE YOURSELF AT HOME');expect(getClubMemberExperience).toHaveBeenCalledTimes(2);expect(setClubNotificationsEnabled).not.toHaveBeenCalled();expect(dismissClubWelcome).not.toHaveBeenCalled();
});

test('header shares the current club while its options sheet stays closed',async()=>{
 await act(async()=>{view=renderer.create(<ClubDetailScreen/>);});
 expect(view.root.findByType(ClubOptionsSheet).props.visible).toBe(false);
 await press('Share club');
 expect(view.root.findByType(ClubOptionsSheet).props.visible).toBe(false);
 await press('Open club options');
 expect(view.root.findAllByType('Pressable').filter(node=>node.props.accessibilityLabel==='Share club')).toHaveLength(1);
 expect(require('../src/lib/share-links').shareClubLink).toHaveBeenCalledWith({clubId:base.id,name:base.name});
});
test('flagged club edits show the shared warning, preserve the editor, and avoid the error overlay',async()=>{
  updateClub.mockRejectedValue({code:'NOVORI_MODERATION',review_id:'review-1',message:'Needs review'});
  await render(<EditClubScreen/>);
  await press('Save club changes');
  expect(text()).toContain('Submission under review');
  expect(text()).toContain('Your club changes need a safety review');
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(silence).not.toHaveBeenCalled();
  const photo=view.root.findAllByType('Image').find(node=>node.props.source?.uri==='club-photo.jpg');
  expect(photo.props.style.borderRadius).toBe(18);
});
