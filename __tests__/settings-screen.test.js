import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {Alert} from 'react-native';
import SettingsScreen from '../src/app/settings';
import NotificationSettingsScreen from '../src/app/notification-settings';
import {getNotificationPreferences,updateNotificationPreference} from '../src/lib/notifications';
import {getReadingReminderPreferences,updateReadingReminderPreferences} from '../src/lib/reading-reminders';
import {getExplicitLanguagePreference,setExplicitLanguagePreference} from '../src/lib/content-filter';
import {supabase} from '../src/lib/supabase';

const mockRouter={push:jest.fn(),back:jest.fn(),replace:jest.fn()};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter}));
jest.mock('react-native',()=>({Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',View:'View',Text:'Text',ScrollView:'ScrollView',Switch:'Switch',StyleSheet:{create:v=>v,hairlineWidth:.5},Alert:{alert:jest.fn()}}));
jest.mock('../src/components/ValidationWarningSheet',()=> 'ValidationWarningSheet');
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({theme:'dark',colors:require('../src/constants/novori-theme').DARK_COLORS})}));
jest.mock('../src/lib/notifications',()=>({getNotificationPreferences:jest.fn(),updateNotificationPreference:jest.fn()}));
jest.mock('../src/lib/reading-reminders',()=>({getReadingReminderPreferences:jest.fn(),updateReadingReminderPreferences:jest.fn()}));
jest.mock('../src/lib/content-filter',()=>({getExplicitLanguagePreference:jest.fn(),setExplicitLanguagePreference:jest.fn()}));
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:jest.fn(),signOut:jest.fn()}}}));
const preferences={new_followers:false,reactions_and_replies:true,club_invites:true,club_activity:true,reading_started:false,reading_finished:true};
const reminders={daily_checkin:true,still_reading:true,weekly_recap:false,monthly_recap:true,reminder_time:'18:00:00',timezone:'America/Chicago'};
let view,silence;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.clearAllMocks();getNotificationPreferences.mockResolvedValue(preferences);updateNotificationPreference.mockImplementation(async(key,value)=>({...preferences,[key]:value}));getReadingReminderPreferences.mockResolvedValue(reminders);updateReadingReminderPreferences.mockImplementation(async(changes)=>({...reminders,...changes}));getExplicitLanguagePreference.mockResolvedValue(false);setExplicitLanguagePreference.mockImplementation(async value=>value);supabase.auth.getUser.mockResolvedValue({data:{user:{id:'me',email:'reader@example.com'}},error:null});supabase.auth.signOut.mockResolvedValue({error:null});silence=jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;silence.mockRestore();});
async function render(element){await act(async()=>{view=renderer.create(element);});}
const text=()=>view.root.findAllByType('Text').map(n=>[n.props.children].flat(Infinity).join('')).join(' ');
const button=label=>view.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel===label);
const toggle=label=>view.root.findAllByType('Switch').find(n=>n.props.accessibilityLabel===label);
async function press(label){expect(button(label)).toBeDefined();await act(async()=>button(label).props.onPress());}
async function change(label,value){await act(async()=>toggle(label).props.onValueChange(value));}

test('Settings keeps real destinations together and marks unavailable account options',async()=>{
 await render(<SettingsScreen/>);expect(text()).toContain('reader@example.com');expect(button('Edit Profile')).toBeUndefined();
 for(const [title,path] of [['Notifications','/notification-settings'],['Appearance','/appearance'],['Privacy','/privacy'],['Blocked Readers','/blocked-readers'],['About Novori','/about-novori'],['Help & Support','/help-support'],['Password & Security','/password-security']]){expect(button(title).props.disabled).not.toBe(true);await press(title);expect(mockRouter.push).toHaveBeenLastCalledWith(path);}
 expect(button('Recovery Phone')).toBeUndefined();expect(button('Delete account').props.disabled).not.toBe(true);expect(button('Email').props.disabled).toBe(true);
 await press('Go back');expect(mockRouter.back).toHaveBeenCalled();
});
test('explicit-language preference preserves save, error recovery, and sign-out confirmation',async()=>{
 await render(<SettingsScreen/>);await change('Allow explicit language',true);expect(setExplicitLanguagePreference).toHaveBeenCalledWith(true);expect(toggle('Allow explicit language').props.value).toBe(true);
 setExplicitLanguagePreference.mockRejectedValue(new Error('Offline'));await change('Allow explicit language',false);expect(toggle('Allow explicit language').props.value).toBe(true);
 await press('Sign Out');expect(supabase.auth.signOut).not.toHaveBeenCalled();const actions=Alert.alert.mock.calls.find(c=>c[0]==='Sign Out')[2];await act(async()=>actions.find(a=>a.text==='Sign Out').onPress());expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
});
test('notification preferences preserve existing opt-outs and expose only working switches',async()=>{
 await render(<NotificationSettingsScreen/>);expect(text()).toContain('4 of 6 activity alerts on');expect(toggle('New Followers').props.value).toBe(false);expect(toggle('Weekly Recap').props.value).toBe(false);
 expect(toggle('Push Notifications')).toBeUndefined();expect(toggle('Sounds')).toBeUndefined();expect(toggle('Group Similar Activity')).toBeUndefined();
 expect(getNotificationPreferences).toHaveBeenCalledTimes(1);expect(getReadingReminderPreferences).toHaveBeenCalledTimes(1);expect(text()).toContain('6 p.m.');expect(text()).toContain('America/Chicago');expect(view.root.findAllByType('TextInput')).toHaveLength(0);
 await change('Club Notifications',false);expect(updateNotificationPreference).toHaveBeenCalledWith('club_activity',false);expect(text()).toContain('off for every club');expect(toggle('Club Invites').props.value).toBe(true);expect(toggle('Likes & Replies').props.value).toBe(true);
 updateNotificationPreference.mockRejectedValue(new Error('Offline'));await change('Club Notifications',true);expect(toggle('Club Notifications').props.value).toBe(false);
});
test('individual reminder saves change only the selected preference and retain the fixed schedule',async()=>{
 await render(<NotificationSettingsScreen/>);await change('Daily Check-in',false);expect(updateReadingReminderPreferences).toHaveBeenCalledWith({daily_checkin:false});expect(toggle('Daily Check-in').props.value).toBe(false);expect(toggle('Still Reading?').props.value).toBe(true);expect(text()).toContain('6 p.m.');
 updateReadingReminderPreferences.mockRejectedValue(new Error('Offline'));await change('Monthly Recap',false);expect(toggle('Monthly Recap').props.value).toBe(true);expect(Alert.alert).toHaveBeenCalledWith('Could not save reminder','Offline');
});
test('unavailable preferences show a retry instead of trapping the user in a spinner',async()=>{
 getNotificationPreferences.mockRejectedValueOnce(new Error('Offline'));getReadingReminderPreferences.mockRejectedValueOnce(new Error('Offline'));await render(<NotificationSettingsScreen/>);
 expect(text()).toContain('couldn’t be loaded');expect(toggle('Club Notifications')).toBeUndefined();expect(button('Go back')).toBeDefined();await press('Retry notification preferences');expect(toggle('Club Notifications').props.value).toBe(true);await press('Retry reading reminders');expect(toggle('Daily Check-in').props.value).toBe(true);
});
