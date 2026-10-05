import {clearAccountRestrictionNotice,rememberAccountRestriction} from '../src/lib/account-restriction-notice';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
import AuthScreen from '../src/app/auth';
import {supabase} from '../src/lib/supabase';
import {getAccountDeletionStatus} from '../src/lib/account-deletion';
const mockRouter={replace:jest.fn(),push:jest.fn()};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useLocalSearchParams:()=>({})}));
jest.mock('react-native',()=>({Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},Keyboard:{addListener:()=>({remove:jest.fn()}),dismiss:jest.fn()},ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',View:'View',Text:'Text',ScrollView:'ScrollView',TextInput:'TextInput',StyleSheet:{create:v=>v},Alert:{alert:jest.fn()}}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('../src/components/ValidationWarningSheet',()=> 'ValidationWarningSheet');
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').DARK_COLORS})}));
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{signInWithPassword:jest.fn()}}}));
jest.mock('../src/lib/account-deletion',()=>({getAccountDeletionStatus:jest.fn()}));
let view,silence;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.clearAllMocks();clearAccountRestrictionNotice();supabase.auth.signInWithPassword.mockResolvedValue({error:null});getAccountDeletionStatus.mockResolvedValue({state:'active'});silence=jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;silence.mockRestore();});
async function submit(){await act(async()=>{view=renderer.create(<AuthScreen/>);});for(const [placeholder,value] of [['Email','reader@example.com'],['Password','password123']])await act(async()=>view.root.findAllByType('TextInput').find(n=>n.props.placeholder===placeholder).props.onChangeText(value));await act(async()=>view.root.findAllByType('Pressable').find(n=>n.findAllByType('Text').some(t=>t.props.children==='Sign In')).props.onPress());}
test('a paused account signs directly into deletion instead of briefly mounting Home',async()=>{getAccountDeletionStatus.mockResolvedValue({state:'pending'});await submit();expect(mockRouter.replace).toHaveBeenCalledWith('/delete-account');});
test('an active account still opens Home',async()=>{await submit();expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');});
test('invalid deleted-account credentials use the animated Novori warning',async()=>{supabase.auth.signInWithPassword.mockResolvedValue({error:new Error('Invalid login credentials')});await submit();expect(view.root.findByType('ValidationWarningSheet').props).toMatchObject({visible:true,title:'Could not sign in',message:'Invalid login credentials'});expect(mockRouter.replace).not.toHaveBeenCalled();});

test('the password eye reveals and hides the existing value without submitting',async()=>{await act(async()=>{view=renderer.create(<AuthScreen/>);});const input=()=>view.root.findAllByType('TextInput').find(n=>n.props.placeholder==='Password');await act(async()=>input().props.onChangeText('TypedPassword'));expect(input().props.secureTextEntry).toBe(true);await act(async()=>view.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel==='Show password').props.onPress());expect(input().props.secureTextEntry).toBe(false);expect(input().props.value).toBe('TypedPassword');await act(async()=>view.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel==='Hide password').props.onPress());expect(input().props.secureTextEntry).toBe(true);expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();});

test('signup has independent eyes for both typed passwords and resets visibility on mode changes',async()=>{
 await act(async()=>{view=renderer.create(<AuthScreen/>);});
 const switchMode=()=>view.root.findAllByType('Pressable').find(n=>n.findAllByType('Text').some(t=>t.props.children==='Create one'||t.props.children==='Sign in'));
 await act(async()=>switchMode().props.onPress());
 const input=placeholder=>view.root.findAllByType('TextInput').find(n=>n.props.placeholder===placeholder);
 await act(async()=>{input('Password').props.onChangeText('FirstPassword');input('Confirm password').props.onChangeText('SecondPassword');});
 const press=label=>view.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel===label).props.onPress();
 await act(async()=>press('Show confirm password'));
 expect(input('Confirm password').props.secureTextEntry).toBe(false);expect(input('Password').props.secureTextEntry).toBe(true);
 await act(async()=>press('Show password'));
 expect(input('Password').props.secureTextEntry).toBe(false);expect(input('Confirm password').props.value).toBe('SecondPassword');
 await act(async()=>press('Hide confirm password'));
 expect(input('Confirm password').props.secureTextEntry).toBe(true);expect(input('Password').props.value).toBe('FirstPassword');
 await act(async()=>switchMode().props.onPress());expect(input('Password').props.secureTextEntry).toBe(true);
 expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
});

 test('banned credentials use a clear Novori restriction warning',async()=>{
 supabase.auth.signInWithPassword.mockResolvedValue({error:Object.assign(new Error('User is banned'),{code:'user_banned'})});
 await submit();expect(view.root.findByType('ValidationWarningSheet').props).toMatchObject({visible:true,title:'Account access restricted'});expect(mockRouter.replace).not.toHaveBeenCalled();
 });
 test('a restriction notice survives a plain sign-out redirect and can be dismissed',async()=>{
 rememberAccountRestriction();await act(async()=>{view=renderer.create(<AuthScreen/>);});
 expect(view.root.findByType('ValidationWarningSheet').props.visible).toBe(true);
 await act(async()=>view.root.findByType('ValidationWarningSheet').props.onDismiss());
 expect(view.root.findByType('ValidationWarningSheet').props.visible).toBe(false);
 });
