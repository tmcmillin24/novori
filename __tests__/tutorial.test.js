import React from 'react';
import renderer,{act} from 'react-test-renderer';
import TutorialScreen from '../src/app/tutorial';
import TutorialGate from '../src/components/TutorialGate';
import {needsTutorial,TUTORIAL_STEPS} from '../src/lib/tutorial';
import {legalAcceptanceMetadata} from '../src/lib/legal-documents';
import {supabase} from '../src/lib/supabase';
const mockRouter={push:jest.fn(),replace:jest.fn(),back:jest.fn(),canGoBack:()=>true};
let mockParams={},mockDimensions={width:390,height:844},mockNavigation={index:0,routes:[{name:'(tabs)'}]},mockAuthCallback;
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useLocalSearchParams:()=>mockParams,useRootNavigationState:()=>mockNavigation}));
jest.mock('react-native',()=>({Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',View:'View',Text:'Text',ScrollView:'ScrollView',StyleSheet:{create:v=>v},useWindowDimensions:()=>mockDimensions}));
jest.mock('react-native-reanimated',()=>({__esModule:true,default:{View:'AnimatedView'},FadeIn:{duration:()=>undefined}}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('../src/components/ValidationWarningSheet',()=> 'ValidationWarningSheet');
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').LIGHT_COLORS})}));
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:jest.fn(),updateUser:jest.fn(),getSession:jest.fn(),onAuthStateChange:jest.fn(callback=>{mockAuthCallback=callback;return {data:{subscription:{unsubscribe:jest.fn()}}};})}}}));
let view,silence;
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.clearAllMocks();mockParams={};mockDimensions={width:390,height:844};mockNavigation={index:0,routes:[{name:'(tabs)'}]};
 supabase.auth.getUser.mockResolvedValue({data:{user:{id:'reader'}},error:null});
 supabase.auth.updateUser.mockResolvedValue({data:{user:{id:'reader'}},error:null});
 supabase.auth.getSession.mockResolvedValue({data:{session:{user:{id:'reader',user_metadata:{}}}}});
 silence=jest.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;silence.mockRestore();});
async function render(element=<TutorialScreen/>){await act(async()=>{view=renderer.create(element);});}
async function press(label){await act(async()=>view.root.findAllByType('Pressable').find(p=>p.props.accessibilityLabel===label).props.onPress());}
test('all ten steps navigate and completion is saved before returning to settings',async()=>{
 await render();expect(TUTORIAL_STEPS).toHaveLength(10);
 for(let n=0;n<9;n++)await press('Next tutorial step');
 expect(view.root.findAllByType('Text').some(t=>t.props.children===TUTORIAL_STEPS[9].title)).toBe(true);
 await press('Previous tutorial step');await press('Next tutorial step');await press('Finish tutorial');
 expect(supabase.auth.updateUser).toHaveBeenCalledWith({data:expect.objectContaining({novori_tutorial_pending:false,novori_tutorial_version:'1'})});
 expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
test('skip saves completion for first-login users and goes to Home',async()=>{
 mockParams={welcome:'1'};await render();await press('Skip tutorial');
 expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
});
test('failed persistence keeps the tutorial open with a Novori warning',async()=>{
 supabase.auth.updateUser.mockResolvedValue({data:{user:null},error:new Error('Offline')});
 await render();await press('Skip tutorial');
 expect(mockRouter.back).not.toHaveBeenCalled();expect(view.root.findByType('ValidationWarningSheet').props.visible).toBe(true);
});
test('landscape tablet content adapts to rotation without resetting the step',async()=>{
 await render();await press('Next tutorial step');mockDimensions={width:1194,height:834};
 await act(async()=>view.update(<TutorialScreen/>));
 expect(view.root.findByType('AnimatedView').props.style.flexDirection).toBe('row');
 expect(view.root.findAllByType('Text').some(t=>t.props.children===TUTORIAL_STEPS[1].title)).toBe(true);
 mockDimensions={width:834,height:1194};await act(async()=>view.update(<TutorialScreen/>));
 expect(view.root.findByType('AnimatedView').props.style.flexDirection).toBe('column');
});
test('existing and completed accounts do not open the tutorial automatically',async()=>{
 expect(needsTutorial({})).toBe(false);expect(needsTutorial({novori_tutorial_pending:true,novori_tutorial_version:'1'})).toBe(false);
 await render(<TutorialGate/>);expect(mockRouter.push).not.toHaveBeenCalled();
});
test('new readers wait for legal acceptance and the tab navigator, then launch once',async()=>{
 const reader={id:'new-reader',user_metadata:{...legalAcceptanceMetadata(),novori_tutorial_pending:true}};
 supabase.auth.getSession.mockResolvedValue({data:{session:{user:{id:'new-reader',user_metadata:{novori_tutorial_pending:true}}}}});
 await render(<TutorialGate/>);expect(mockRouter.push).not.toHaveBeenCalled();
 mockNavigation={index:0,routes:[{name:'auth'}]};await act(async()=>mockAuthCallback('USER_UPDATED',{user:reader}));expect(mockRouter.push).not.toHaveBeenCalled();
 mockNavigation={index:0,routes:[{name:'(tabs)'}]};await act(async()=>view.update(<TutorialGate/>));
 expect(mockRouter.push).toHaveBeenCalledTimes(1);
 await act(async()=>mockAuthCallback('TOKEN_REFRESHED',{user:reader}));expect(mockRouter.push).toHaveBeenCalledTimes(1);
});
