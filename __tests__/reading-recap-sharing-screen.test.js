import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ShareReadingRecapScreen from '../src/app/share-reading-recap';
import ReadingRecapPostAttachment from '../src/components/ReadingRecapPostAttachment';
import { getMyClubs } from '../src/lib/clubs';
import { getEditableReadingRecap, getReadingRecapSnapshot, publishReadingRecap, updateReadingRecap } from '../src/lib/reading-recap-sharing';

const mockRouter={replace:jest.fn(),back:jest.fn(),push:jest.fn()};
let mockParams;
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useLocalSearchParams:()=>mockParams}));
jest.mock('react-native',()=>({ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',Text:'Text',TextInput:'TextInput',View:'View',Image:'Image',
  StyleSheet:{create:v=>v,absoluteFill:{},hairlineWidth:0.5},Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null}}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('react-native-keyboard-controller',()=>({KeyboardAwareScrollView:'KeyboardAwareScrollView'}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').DARK_COLORS})}));
jest.mock('../src/hooks/use-post-composer-profile',()=>()=>({display_name:'Reader',username:'reader',avatar_url:'profile.jpg'}));
jest.mock('../src/components/PostDestinationPicker',()=> 'PostDestinationPicker');
jest.mock('../src/components/ClubDestinationImage',()=> 'ClubDestinationImage');
jest.mock('../src/components/BookCoverImage',()=> 'BookCoverImage');
jest.mock('../src/components/ValidationWarningSheet',()=> 'ValidationWarningSheet');
jest.mock('../src/lib/clubs',()=>({getMyClubs:jest.fn()}));
jest.mock('../src/lib/reading-recap-sharing',()=>({createRecapShareKey:()=> 'stable-share-request-key',getEditableReadingRecap:jest.fn(),getReadingRecapSnapshot:jest.fn(),publishReadingRecap:jest.fn(),updateReadingRecap:jest.fn()}));

const snapshot={schemaVersion:1,kind:'month',periodStart:'2024-03-01',periodEndExclusive:'2024-04-01',throughDate:'2024-03-31',finishedBooks:8,daysRead:12,bestStreak:4,
  books:[{googleBookId:'stored-book',isbn:'9781234567897',title:'A story',coverUrl:'https://example.com/stored.jpg'}]};
const club={id:'club-1',name:'Readers Club',cover_url:'club.jpg',membership_role:'member'};
let view,silence;
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true; jest.clearAllMocks();mockParams={kind:'month',periodStart:'2024-03-01'};
  getMyClubs.mockResolvedValue([club]);getReadingRecapSnapshot.mockResolvedValue(snapshot);publishReadingRecap.mockResolvedValue('post-1');updateReadingRecap.mockResolvedValue('post-1');
  getEditableReadingRecap.mockResolvedValue({id:'post-1',author_id:'reader',reading_recap:snapshot,body:'My caption',club_id:'club-1'});
  silence=jest.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;silence.mockRestore();});
async function render(element=<ShareReadingRecapScreen/>){await act(async()=>{view=renderer.create(element);});}
function button(label){return view.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel===label);}
async function press(label){await act(async()=>button(label).props.onPress());}
async function caption(value){await act(async()=>view.root.findByType('TextInput').props.onChangeText(value));}
async function destination(id){await act(async()=>view.root.findByType('PostDestinationPicker').props.onClubIdChange(id));}

test('opening a recap prepares the editable feed card without publishing or a second preview',async()=>{
  await render();expect(getReadingRecapSnapshot).toHaveBeenCalledWith('month','2024-03-01');expect(publishReadingRecap).not.toHaveBeenCalled();
  expect(view.root.findAllByType(ReadingRecapPostAttachment)).toHaveLength(1);
  expect(view.root.findByType('PostDestinationPicker').props).toMatchObject({clubs:[club],clubId:null,profile:{avatar_url:'profile.jpg'}});
  expect(view.root.findByType('TextInput').props.multiline).toBe(true);
});
test('publishing to feed keeps the prepared snapshot and exits directly',async()=>{
  await render();await caption('A great month');await press('Publish reading recap');
  expect(publishReadingRecap).toHaveBeenCalledWith(snapshot,'A great month',null,'stable-share-request-key');expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
});
test('a joined club selection appears inside the editable card and is the publish destination',async()=>{
  await render();await destination('club-1');
  expect(view.root.findAllByType('Text').some(n=>n.props.children==='in Readers Club')).toBe(true);
  await press('Publish reading recap');expect(publishReadingRecap.mock.calls[0][2]).toBe('club-1');
});
test('rapid double taps create only one request while awaiting publication',async()=>{
  let resolve;publishReadingRecap.mockImplementation(()=>new Promise(done=>{resolve=done;}));await render();
  await act(async()=>{const publish=button('Publish reading recap').props.onPress;publish();publish();});
  expect(publishReadingRecap).toHaveBeenCalledTimes(1);expect(button('Publish reading recap').props.disabled).toBe(true);
  await act(async()=>resolve('post-1'));expect(mockRouter.replace).toHaveBeenCalledTimes(1);
});
test('publication errors use the app warning sheet and retain the same key and destination for retry',async()=>{
  publishReadingRecap.mockRejectedValueOnce(new Error('Your recap changed. Reload it before sharing.'));
  await render();await caption('Keep this');await destination('club-1');await press('Publish reading recap');
  expect(mockRouter.replace).not.toHaveBeenCalled();expect(view.root.findByType('ValidationWarningSheet').props).toMatchObject({visible:true,message:'Your recap changed. Reload it before sharing.'});
  await press('Publish reading recap');expect(publishReadingRecap.mock.calls[0]).toEqual(publishReadingRecap.mock.calls[1]);
});
test('refreshing stale statistics keeps the caption and chosen club',async()=>{
  await render();await caption('Keep this');await destination('club-1');getReadingRecapSnapshot.mockResolvedValue({...snapshot,finishedBooks:9});
  await press('Reload reading recap stats');await press('Publish reading recap');
  expect(publishReadingRecap.mock.calls[0]).toEqual([{...snapshot,finishedBooks:9},'Keep this','club-1','stable-share-request-key']);
});
test('editing reuses the frozen post snapshot and changes only caption/destination',async()=>{
  mockParams={editPostId:'post-1'};await render();expect(getReadingRecapSnapshot).not.toHaveBeenCalled();expect(getEditableReadingRecap).toHaveBeenCalledWith('post-1');
  await caption('Edited');await destination(null);await press('Save reading recap changes');
  expect(updateReadingRecap).toHaveBeenCalledWith('post-1','Edited',null);expect(publishReadingRecap).not.toHaveBeenCalled();
});
test('a club loading failure blocks publication and retries the draft',async()=>{
  getMyClubs.mockRejectedValueOnce(new Error('Could not load clubs'));await render();expect(button('Publish reading recap')).toBeUndefined();
  await press('Retry recap draft');expect(button('Publish reading recap')).toBeDefined();expect(publishReadingRecap).not.toHaveBeenCalled();
});
test('cancelling a draft makes no write',async()=>{await render();await press('Back');expect(mockRouter.back).toHaveBeenCalled();expect(publishReadingRecap).not.toHaveBeenCalled();});
test('the reusable post card renders supplied cover identities without a private-history read',async()=>{
  await render(<ReadingRecapPostAttachment snapshot={snapshot}/>);
  expect(view.root.findByType('BookCoverImage').props).toMatchObject({googleBookId:'stored-book',isbn:'9781234567897',existingCoverUrl:'https://example.com/stored.jpg'});
  expect(getReadingRecapSnapshot).not.toHaveBeenCalled();expect(getMyClubs).not.toHaveBeenCalled();
});
