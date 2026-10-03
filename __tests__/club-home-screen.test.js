import React from 'react';
import renderer, { act } from 'react-test-renderer';
import EditClubScreen from '../src/app/edit-club';
import CreateClubScreen from '../src/app/create-club';
import ClubDetailScreen from '../src/app/club/[id]';
import ClubHomeCard from '../src/components/ClubHomeCard';
import ClubOptionsSheet from '../src/components/ClubOptionsSheet';
import { getClub, getClubMembers, getPendingClubInvitesForManager, updateClub, createClub } from '../src/lib/clubs';
import { getClubPosts } from '../src/lib/feed';

const mockRouter={push:jest.fn(),back:jest.fn(),replace:jest.fn()};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useLocalSearchParams:()=>({id:'club-1',clubId:'club-1'}),useFocusEffect:callback=>require('react').useEffect(callback,[callback])}));
jest.mock('react-native',()=>({
  KeyboardAvoidingView:'KeyboardAvoidingView',Text:'Text',View:'View',Pressable:'Pressable',Image:'Image',TextInput:'TextInput',ActivityIndicator:'ActivityIndicator',RefreshControl:'RefreshControl',
  Alert:{alert:jest.fn()},Keyboard:{dismiss:jest.fn()},Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},
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
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:'owner'}}})}}}));
jest.mock('../src/lib/clubs',()=>({updateClub:jest.fn(),createClub:jest.fn(),uploadClubCover:jest.fn(),getClub:jest.fn(),getClubMembers:jest.fn(),getPendingClubInvite:async()=>null,getPendingPrivateClubRequest:async()=>null,
  getPendingClubInvitesForManager:jest.fn(),getPendingClubJoinRequestsForManager:async()=>[],searchClubInviteCandidates:jest.fn()}));
jest.mock('../src/lib/feed',()=>({getClubPosts:jest.fn()}));
jest.mock('../src/lib/reports',()=>({}));jest.mock('../src/lib/social',()=>({}));jest.mock('../src/lib/share-links',()=>({}));
const base={id:'club-1',owner_id:'owner',name:'Readers Club',description:'A home for good books.',privacy:'public',genres:[],cover_url:'club-photo.jpg',rules:'Be kind.\nLabel spoilers.',member_count:2,membership_role:'owner'};
let view,silence;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.clearAllMocks();getClub.mockResolvedValue(base);
  getClubMembers.mockResolvedValue([{user_id:'owner',role:'owner',display_name:'Founder Person',username:'owner',avatar_url:null},{user_id:'member',role:'member',display_name:'Member Reader',username:'member',avatar_url:null}]);
  updateClub.mockResolvedValue(base);createClub.mockResolvedValue(base);getClubPosts.mockResolvedValue([]);getPendingClubInvitesForManager.mockResolvedValue([]);silence=jest.spyOn(console,'error').mockImplementation(()=>{});
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
  expect(getClubMembers).not.toHaveBeenCalled();expect(getClubPosts).not.toHaveBeenCalled();expect(getPendingClubInvitesForManager).not.toHaveBeenCalled();
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
