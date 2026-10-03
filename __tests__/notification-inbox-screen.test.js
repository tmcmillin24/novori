import React from 'react';
import renderer,{act} from 'react-test-renderer';
import NotificationsScreen from '../src/app/(tabs)/notifications';
import {getNotifications,markNotificationRead,markAllNotificationsRead,clearNotification,clearAllNotifications} from '../src/lib/notifications';
import {getPendingFollowRequestCount} from '../src/lib/social';

const mockRouter={push:jest.fn(),back:jest.fn()};let mockRealtime;let mockExplicit=false;
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useFocusEffect:cb=>require('react').useEffect(cb,[cb])}));
jest.mock('react-native',()=>({
 Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},ActivityIndicator:'ActivityIndicator',View:'View',Text:'Text',Image:'Image',Pressable:'Pressable',RefreshControl:'RefreshControl',
 FlatList:({data,renderItem,ListHeaderComponent,ListEmptyComponent,...props})=>require('react').createElement('FlatList',props,ListHeaderComponent,data.length?data.map(item=>require('react').createElement(require('react').Fragment,{key:item.key},renderItem({item}))):ListEmptyComponent),
 StyleSheet:{create:v=>v,absoluteFill:{},hairlineWidth:.5},Alert:{alert:jest.fn()},
 Animated:{View:'AnimatedView',Value:class{setValue(){}stopAnimation(){}},timing:()=>({start:cb=>cb?.({finished:true})})},
 Easing:{bezier:()=>{}},PanResponder:{create:config=>({panHandlers:config})},
}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('../src/components/DeletePostConfirmSheet',()=> 'DeletePostConfirmSheet');
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').DARK_COLORS})}));
jest.mock('../src/lib/notifications',()=>({getNotifications:jest.fn(),markNotificationRead:jest.fn(),markAllNotificationsRead:jest.fn(),clearNotification:jest.fn(),clearAllNotifications:jest.fn()}));
jest.mock('../src/lib/social',()=>({getPendingFollowRequestCount:jest.fn()}));
jest.mock('../src/lib/content-filter',()=>({containsExplicitLanguage:body=>body.includes('bad-language'),getExplicitLanguagePreference:async()=>mockExplicit,isExplicitContentRevealed:()=>false}));
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:'me'}}})},channel:()=>{const channel={on:(_,__,callback)=>{mockRealtime=callback;return channel;},subscribe:()=>channel};return channel;},removeChannel:jest.fn()}}));
const item=(id,type,extra={})=>({id,type,recipient_id:'me',actor_id:'other',actor_display_name:'A Reader',actor_avatar_url:'stored-avatar',actor_username:'reader',title:'Update '+id,body:'An update from a reader.',entity_type:null,entity_id:null,image_url:null,metadata:{},created_at:new Date().toISOString(),read_at:null,...extra});
const updates=[item('club','club_post',{entity_type:'club',entity_id:'club-1',metadata:{club_id:'club-1',post_id:'post-1'}}),item('reply','reply',{metadata:{post_id:'post-1',comment_id:'comment-3'}}),item('read','reading_finished',{image_url:'stored-cover',metadata:{google_book_id:'book-1'}}),item('follow','follow',{entity_id:'reader-2'})];
let view,silence;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.clearAllMocks();mockExplicit=false;getNotifications.mockResolvedValue(updates);getPendingFollowRequestCount.mockResolvedValue(0);markNotificationRead.mockResolvedValue();markAllNotificationsRead.mockResolvedValue();clearNotification.mockResolvedValue();clearAllNotifications.mockResolvedValue();silence=jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;silence.mockRestore();});
const text=()=>view.root.findAllByType('Text').map(n=>[n.props.children].flat(Infinity).join('')).join(' ');
const button=label=>view.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel===label);
async function render(){await act(async()=>{view=renderer.create(<NotificationsScreen/>);});}
async function press(label){expect(button(label)).toBeDefined();await act(async()=>button(label).props.onPress());}

test('filters use the same loaded inbox, stored images, and existing reply destinations',async()=>{
 await render();expect(text()).toContain('4 new updates');expect(getNotifications).toHaveBeenCalledTimes(1);
 expect(view.root.findAllByType('Image').map(n=>n.props.source.uri)).toContain('stored-cover');
 await press('Show clubs notifications');expect(button('Open notification: club')).toBeDefined();expect(button('Open notification: reply')).toBeUndefined();
 await press('Show replies notifications');expect(button('Open notification: reply')).toBeDefined();expect(button('Open notification: club')).toBeUndefined();
 await press('Open notification: reply');expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/post/[id]',params:{id:'post-1',commentId:'comment-3'}});expect(markNotificationRead).toHaveBeenCalledWith('reply');
 await press('Show reading notifications');expect(button('Open notification: read')).toBeDefined();expect(getNotifications).toHaveBeenCalledTimes(1);await press('Notification settings');expect(mockRouter.push).toHaveBeenCalledWith('/notification-settings');
});
test('follow requests and club events, welcomes, and shared reads keep their destinations',async()=>{
 getPendingFollowRequestCount.mockResolvedValue(2);getNotifications.mockResolvedValue([item('event','club_event',{metadata:{event_id:'event-1',club_id:'club-1'}}),item('welcome','club_member',{entity_type:'club',entity_id:'club-1',metadata:{activity_kind:'welcome'}}),item('current','club_post',{entity_type:'club',entity_id:'club-1',metadata:{activity_kind:'current_read'}})]);
 await render();await press('View follow requests');expect(mockRouter.push).toHaveBeenLastCalledWith('/follow-requests');await press('Open notification: event');expect(mockRouter.push).toHaveBeenLastCalledWith({pathname:'/club-event/[id]',params:{id:'event-1'}});await press('Open notification: welcome');expect(mockRouter.push).toHaveBeenLastCalledWith({pathname:'/club/[id]',params:{id:'club-1',guide:'1'}});await press('Open notification: current');expect(mockRouter.push).toHaveBeenLastCalledWith({pathname:'/club/[id]',params:{id:'club-1',tab:'books'}});
});
test('explicit previews stay hidden and clear all waits for confirmation across filters',async()=>{
 getNotifications.mockResolvedValue([item('explicit','reply',{body:'bad-language preview',metadata:{post_id:'post-1',comment_id:'comment-1'}}),updates[0]]);await render();expect(text()).toContain('Explicit language hidden');expect(text()).not.toContain('bad-language preview');await press('Show replies notifications');await press('Clear all notifications');expect(clearAllNotifications).not.toHaveBeenCalled();const confirm=view.root.findByType('DeletePostConfirmSheet');expect(confirm.props.visible).toBe(true);await act(async()=>confirm.props.onDismiss());expect(view.root.findByType('DeletePostConfirmSheet').props.visible).toBe(false);await press('Clear all notifications');await act(async()=>view.root.findByType('DeletePostConfirmSheet').props.onConfirm());expect(clearAllNotifications).toHaveBeenCalledTimes(1);expect(button('Open notification: explicit')).toBeUndefined();await press('Show all notifications');expect(button('Open notification: club')).toBeUndefined();expect(text()).toContain('A quiet moment');
});
test('an empty filter can still refresh and shows a useful club mute hint',async()=>{
 getNotifications.mockResolvedValue([updates[3]]);await render();await press('Show clubs notifications');expect(text()).toContain('mute any club');const refresh=view.root.findByType('FlatList').props.refreshControl;await act(async()=>refresh.props.onRefresh());expect(getNotifications).toHaveBeenCalledTimes(2);
});
test('failed swipe deletion restores the item while preserving a newly arrived alert',async()=>{
 let rejectDelete;clearNotification.mockImplementation(()=>new Promise((_,reject)=>{rejectDelete=reject;}));await render();const row=button('Open notification: reply').parent;const animated=row.findByType('AnimatedView');await act(async()=>animated.props.onPanResponderRelease({}, {dx:-200,vx:-1}));expect(button('Open notification: reply')).toBeUndefined();
 const incoming=item('incoming','comment',{metadata:{post_id:'post-2'}});getNotifications.mockResolvedValue([...updates.filter(n=>n.id!=='reply'),incoming]);await act(async()=>mockRealtime({eventType:'INSERT'}));await act(async()=>rejectDelete(new Error('Offline')));expect(button('Open notification: reply')).toBeDefined();expect(button('Open notification: incoming')).toBeDefined();
});
