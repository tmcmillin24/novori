import React,{useEffect} from 'react';
import renderer,{act} from 'react-test-renderer';
import TutorialOverlay,{spotlightLayout} from '../src/components/TutorialOverlay';
import TutorialLauncher from '../src/app/tutorial';
import TutorialGate from '../src/components/TutorialGate';
import {TutorialProvider,useTutorial} from '../src/context/tutorial-context';
import {needsTutorial,TUTORIAL_STEPS,tutorialRevealOffset} from '../src/lib/tutorial';
import {legalAcceptanceMetadata} from '../src/lib/legal-documents';
import {supabase} from '../src/lib/supabase';
let mockPath='/',mockParams={},mockDimensions={width:390,height:844},mockNavigation={index:0,routes:[{name:'(tabs)'}]},mockAuthCallback,mockTour,mockMeasure=true;
const routePath=route=>route==='/(tabs)'?'/':route.replace('/(tabs)','');
const mockRouter={push:jest.fn(),replace:jest.fn(route=>{mockPath=routePath(route);}),navigate:jest.fn(route=>{mockPath=routePath(route);})};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,usePathname:()=>mockPath,useLocalSearchParams:()=>mockParams,useRootNavigationState:()=>mockNavigation}));
jest.mock('react-native',()=>({Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},Keyboard:{dismiss:jest.fn()},BackHandler:{addEventListener:()=>({remove:jest.fn()})},ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',View:'View',Text:'Text',StyleSheet:{create:v=>v},useWindowDimensions:()=>mockDimensions}));
jest.mock('react-native-reanimated',()=>({__esModule:true,default:{View:'AnimatedView'},useSharedValue:value=>require('react').useRef({value}).current,useAnimatedStyle:fn=>fn(),withTiming:(value,config,callback)=>{callback?.(true);return value;},runOnJS:fn=>fn}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:44,bottom:34})}));
jest.mock('../src/components/ValidationWarningSheet',()=> 'ValidationWarningSheet');
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').LIGHT_COLORS})}));
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:jest.fn(),updateUser:jest.fn(),getSession:jest.fn(),onAuthStateChange:jest.fn(callback=>{mockAuthCallback=callback;return {data:{subscription:{unsubscribe:jest.fn()}}};})}}}));
function Controls(){
 const tour=useTutorial();mockTour=tour;
 useEffect(()=>{if(mockMeasure&&tour.active&&tour.pathname===tour.step.path)tour.measure(tour.step.anchor,{x:40,y:tour.step.anchor.startsWith('tab-')?750:180,width:tour.step.anchor.startsWith('tab-')?24:140,height:tour.step.anchor.startsWith('tab-')?24:44});},[tour.active,tour.step.anchor,tour.pathname,tour.measure]);
 return null;
}
function Harness({launch=false}){return <TutorialProvider><Controls/>{launch?<TutorialLauncher/>:null}<TutorialOverlay/></TutorialProvider>;}
let view,silence;
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;mockMeasure=true;jest.clearAllMocks();mockPath='/';mockParams={};mockDimensions={width:390,height:844};mockNavigation={index:0,routes:[{name:'(tabs)'}]};
 supabase.auth.getUser.mockResolvedValue({data:{user:{id:'reader'}},error:null});
 supabase.auth.updateUser.mockResolvedValue({data:{user:{id:'reader'}},error:null});
 supabase.auth.getSession.mockResolvedValue({data:{session:{user:{id:'reader',user_metadata:{}}}}});
 silence=jest.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;silence.mockRestore();});
async function render(element=<Harness/>){await act(async()=>{view=renderer.create(element);});}
async function redraw(){await act(async()=>view.update(<Harness/>));}
async function start(){await render();await act(async()=>mockTour.start());await redraw();}
async function press(label){const button=view.root.findAllByType('Pressable').find(p=>p.props.accessibilityLabel===label);expect(button.props.disabled).toBeFalsy();await act(async()=>button.props.onPress());await redraw();}
test('all creation options and real-control steps navigate through Home, Discover, creation, Library and Profile',async()=>{
 await start();expect(TUTORIAL_STEPS).toHaveLength(13);
 expect(mockTour.step.anchor).toBe('tab-home');
 await press('Continue from highlighted control');expect(mockTour.step.anchor).toBe('home-feed');
 await press('Next tutorial step');expect(mockTour.step.anchor).toBe('home-clubs');
 await press('Next tutorial step');expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/discover');
 await press('Next tutorial step');expect(mockTour.step.anchor).toBe('discover-books');
 await press('Next tutorial step');expect(mockTour.step.anchor).toBe('discover-readers');
 await press('Next tutorial step');expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/post');
 await press('Next tutorial step');expect(mockTour.step.anchor).toBe('create-post');
 await press('Next tutorial step');expect(mockTour.step.anchor).toBe('create-reading-update');
 await press('Next tutorial step');expect(mockTour.step.anchor).toBe('create-ask-readers');
 await press('Next tutorial step');expect(mockTour.step.anchor).toBe('create-book-stack');
 await press('Next tutorial step');expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/library');
 await press('Next tutorial step');expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/profile');
 await press('Previous tutorial step');expect(mockTour.step.anchor).toBe('tab-library');
 await press('Next tutorial step');await press('Finish tutorial');
 expect(supabase.auth.updateUser).toHaveBeenCalledWith({data:expect.objectContaining({novori_tutorial_pending:false,novori_tutorial_version:'1'})});
 expect(mockTour.active).toBe(false);expect(mockRouter.navigate).toHaveBeenCalledWith('/settings');
});
test('highlight uses measured native coordinates and leaves Next on the actual control',async()=>{
 await start();const button=view.root.findAllByType('Pressable').find(p=>p.props.accessibilityLabel==='Continue from highlighted control');
 expect(button.parent.props.style).toMatchObject({left:40,top:750,width:24,height:24});
 const mask=view.root.findByProps({testID:'tutorial-rounded-mask'});
 expect(mask.props.style.borderColor).toBe('rgba(0,0,0,0.72)');
 expect(mask.props.style.borderRadius-mask.props.style.borderWidth).toBe(button.props.style.borderRadius);
 expect(button.props.style.borderRadius).toBe(10);
});
test('skip saves completion and automatic tours finish on Home',async()=>{
 mockParams={welcome:'1'};await render(<Harness launch/>);await redraw();await press('Skip tutorial');
 expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)');
});
test('failed persistence keeps the tour open with the familiar warning',async()=>{
 supabase.auth.updateUser.mockResolvedValue({data:{user:null},error:new Error('Offline')});await start();await press('Skip tutorial');
 expect(mockTour.active).toBe(true);expect(view.root.findByType('ValidationWarningSheet').props.visible).toBe(true);
});
test('tooltip and highlight remain inside iPhone and rotated iPad bounds',()=>{
 for(const [width,height] of [[390,844],[834,1194],[1194,834],[744,1133]]){
  const result=spotlightLayout({x:width-65,y:height-85,width:24,height:24},width,height,44,34,230,true);
  expect(result.card.left).toBeGreaterThanOrEqual(16);expect(result.card.left+result.card.width).toBeLessThanOrEqual(width-16);
  expect(result.card.top).toBeGreaterThanOrEqual(44);expect(result.card.top+230).toBeLessThanOrEqual(height-34);
  expect(result.target.x+result.target.width).toBeLessThanOrEqual(width);
 }
 const stale=spotlightLayout({x:1100,y:750,width:24,height:24},744,1133,44,34,230,true);expect(stale.target.width).toBeGreaterThanOrEqual(0);
});
test('existing and completed accounts do not automatically launch',async()=>{
 expect(needsTutorial({})).toBe(false);expect(needsTutorial({novori_tutorial_pending:true,novori_tutorial_version:'1'})).toBe(false);
 await render(<TutorialGate/>);expect(mockRouter.push).not.toHaveBeenCalled();
});
test('automatic start waits for legal acceptance and normal navigation and runs once',async()=>{
 const reader={id:'new-reader',user_metadata:{...legalAcceptanceMetadata(),novori_tutorial_pending:true}};
 supabase.auth.getSession.mockResolvedValue({data:{session:{user:{id:'new-reader',user_metadata:{novori_tutorial_pending:true}}}}});
 await render(<TutorialGate/>);expect(mockRouter.push).not.toHaveBeenCalled();
 mockNavigation={index:0,routes:[{name:'auth'}]};await act(async()=>mockAuthCallback('USER_UPDATED',{user:reader}));expect(mockRouter.push).not.toHaveBeenCalled();
 mockNavigation={index:0,routes:[{name:'(tabs)'}]};await act(async()=>view.update(<TutorialGate/>));expect(mockRouter.push).toHaveBeenCalledTimes(1);
 await act(async()=>mockAuthCallback('TOKEN_REFRESHED',{user:reader}));expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

test('spotlight follows circular plus and rounded card/button geometry',()=>{
 const plus=spotlightLayout({x:168,y:720,width:54,height:54},390,844,44,34,230,true,'tab-create').target;
 expect(plus).toMatchObject({x:168,y:720,width:54,height:54,radius:27});
 for(const [anchor,radius] of [['home-feed',10],['discover-books',10],['create-post',22],['create-reading-update',18],['create-ask-readers',18],['create-book-stack',18]]){
  const target=spotlightLayout({x:20,y:150,width:160,height:120},390,844,44,34,230,false,anchor).target;
  expect(target).toMatchObject({x:20,y:150,width:160,height:120,radius});
 }
});

test('prompt follows the highlighted control without covering it or animating',async()=>{
 await start();await press('Next tutorial step');
 const panel=view.root.findByProps({testID:'tutorial-description-panel'}).props.style;
 expect(panel.top).toBeGreaterThanOrEqual(180+44+16);
 expect(view.root.findAllByType('AnimatedView')).toHaveLength(0);
});
test('prompt is absent until the corresponding highlight is measured',async()=>{
 await render();await act(async()=>mockTour.start());
 // The route has not yet rendered its new native controls.
 await act(async()=>mockTour.next());await act(async()=>mockTour.next());await act(async()=>mockTour.next());
 expect(mockTour.bounds).toBeNull();
 expect(view.root.findAllByProps({testID:'tutorial-description-panel'})).toHaveLength(0);
 expect(view.root.findAllByProps({testID:'tutorial-rounded-mask'})).toHaveLength(0);
 expect(view.root.findByProps({testID:'tutorial-preparing-screen'}).props.style.backgroundColor).toBe(require('../src/constants/novori-theme').LIGHT_COLORS.background);
});
test('creation-card prompts clear the complete target on phone and tablet',()=>{
 for(const [width,height] of [[390,844],[834,1194],[1194,834],[744,1133]]){
  for(const anchor of ['create-post','create-reading-update','create-ask-readers','create-book-stack']){
   const result=spotlightLayout({x:20,y:84,width:width-40,height:anchor==='create-post'?230:184,radius:18},width,height,44,34,280,false,anchor);
   expect(result.card.top).toBeGreaterThanOrEqual(result.target.y+result.target.height+16);
   expect(result.card.top+280).toBeLessThanOrEqual(height-34-16);
  }
 }
});

test('premeasured controls on the same screen switch prompt and highlight immediately',async()=>{
 await start();await press('Next tutorial step');
 await act(async()=>mockTour.measure('home-clubs',{x:180,y:100,width:140,height:40,radius:10}));
 expect(mockTour.step.anchor).toBe('home-feed');
 await act(async()=>mockTour.next());
 expect(mockTour.step.anchor).toBe('home-clubs');
 expect(mockTour.bounds).not.toBeNull();
 expect(view.root.findAllByProps({testID:'tutorial-description-panel'})).toHaveLength(1);
 expect(view.root.findAllByProps({testID:'tutorial-rounded-mask'})).toHaveLength(1);
});

test('creation tour preserves visible cards and reveals clipped cards with minimal scrolling',()=>{
 expect(tutorialRevealOffset(200,230,0,80,740)).toBe(0);
 expect(tutorialRevealOffset(630,184,0,80,740)).toBe(74);
 expect(tutorialRevealOffset(50,120,200,80,740)).toBe(170);
 expect(tutorialRevealOffset(500,184,74,80,740)).toBe(74);
});

test('same-screen preparation retains the settled prompt and highlight without a blink',async()=>{
 await start();mockMeasure=false;
 await act(async()=>mockTour.next());
 expect(mockTour.bounds).toBeNull();
 expect(view.root.findAllByProps({testID:'tutorial-description-panel'})).toHaveLength(1);
 expect(view.root.findAllByProps({testID:'tutorial-rounded-mask'})).toHaveLength(1);
 expect(view.root.findAllByProps({testID:'tutorial-preparing-screen'})).toHaveLength(0);
 expect(view.root.findAllByType('Text').some(t=>t.props.children==='Start at Home')).toBe(true);
 await act(async()=>mockTour.measure('home-feed',{x:40,y:180,width:140,height:44,radius:10}));
 expect(view.root.findAllByType('Text').some(t=>t.props.children==='Your Feed')).toBe(true);
});

test('bottom-row reveal uses the measured viewport instead of subtracting tab insets twice',()=>{
 // Both cards fit in a native viewport ending at 810; a guessed 740 bottom would scroll them.
 expect(tutorialRevealOffset(610,184,0,92,798)).toBe(0);
 expect(tutorialRevealOffset(630,184,0,92,798)).toBe(16);
});
