import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {useUiSheetMotion} from '../src/components/UiSheet';
import {useUiSwipeDismiss} from '../src/lib/use-ui-swipe-dismiss';
import {useUiCropGesture} from '../src/lib/use-ui-crop-gesture';
let mockAnimations=[],mockFrames=[];
jest.mock('react-native',()=>({Modal:'Modal',Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null}}));
jest.mock('react-native-worklets',()=>({scheduleOnRN:(fn,...args)=>fn(...args),scheduleOnUI:(fn,...args)=>fn(...args)}));
jest.mock('react-native-reanimated',()=>({
 __esModule:true,default:{View:'AnimatedView'},Easing:{bezier:()=>()=>0,out:value=>value,cubic:()=>0},
 useSharedValue:value=>require('react').useRef({value}).current,useAnimatedStyle:read=>({read}),cancelAnimation:jest.fn(),
 withTiming:(value,config,callback)=>{mockAnimations.push({value,config,callback});return value;},
 withSpring:(value,config,callback)=>{mockAnimations.push({value,config,callback});return value;},
}));
jest.mock('react-native-gesture-handler',()=>({GestureDetector:'GestureDetector',GestureHandlerRootView:'Root',Gesture:{
 Pan:()=>{const g={handlers:{}};for(const key of ['activeOffsetX','activeOffsetY','failOffsetX','failOffsetY','enabled','maxPointers','minDistance','onStart','onUpdate','onEnd','onFinalize'])g[key]=value=>{g.handlers[key]=value;return g;};return g;},
 Pinch:()=>{const g={handlers:{}};for(const key of ['enabled','onStart','onUpdate','onFinalize'])g[key]=value=>{g.handlers[key]=value;return g;};return g;},
 Simultaneous:(...gestures)=>({gestures}),
}}));
let view,api;const dismiss=jest.fn(),commit=jest.fn();
function Harness({kind='sheet',visible=true,busy=false,embedded=false}){
 api=kind==='sheet'?useUiSheetMotion({visible,busy,embedded,onDismiss:dismiss}):kind==='swipe'?useUiSwipeDismiss(390,dismiss):useUiCropGesture({geometry:{baseWidth:300,baseHeight:400},size:300,maxZoom:4,x:0,y:0,zoom:1,busy,onCommit:commit});return null;
}
async function mount(props={}){await act(async()=>{view=renderer.create(<Harness {...props}/>);});}
function finish(){const frames=mockFrames;mockFrames=[];frames.forEach(fn=>fn());const animations=mockAnimations;mockAnimations=[];animations.forEach(a=>a.callback?.(true));}
function open(){api.onLayout({nativeEvent:{layout:{height:400}}});api.onShow();finish();}
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;mockAnimations=[];mockFrames=[];global.requestAnimationFrame=fn=>{mockFrames.push(fn);return mockFrames.length;};jest.clearAllMocks();});
afterEach(async()=>{await act(async()=>view?.unmount());view=null;});
test('sheet starts fully below its bounds and opens only after native presentation and layout',async()=>{
 await mount();api.onShow();expect(mockFrames).toHaveLength(0);api.onLayout({nativeEvent:{layout:{height:400}}});expect(api.sheetStyle.read().transform[0].translateY).toBe(401);expect(mockAnimations).toHaveLength(0);finish();expect(api.sheetStyle.read().transform[0].translateY).toBe(0);expect(dismiss).not.toHaveBeenCalled();
});
test('canceling visibility before the first UI frame cannot restart the sheet',async()=>{
 await mount();api.onShow();api.onLayout({nativeEvent:{layout:{height:400}}});await act(async()=>view.update(<Harness visible={false}/>));finish();expect(mockAnimations).toHaveLength(0);expect(dismiss).not.toHaveBeenCalled();
});
test('drag frames stay local; one completed dismissal invokes callback then action once',async()=>{
 await mount();open();const action=jest.fn();api.gesture.handlers.onStart();[20,40,70].forEach(translationY=>api.gesture.handlers.onUpdate({translationY}));expect(dismiss).not.toHaveBeenCalled();expect(api.sheetStyle.read().transform[0].translateY).toBe(70);api.close(action);api.close(action);expect(action).not.toHaveBeenCalled();finish();expect(dismiss).toHaveBeenCalledTimes(1);expect(action).toHaveBeenCalledTimes(1);expect(dismiss.mock.invocationCallOrder[0]).toBeLessThan(action.mock.invocationCallOrder[0]);
});
test('busy actions block user dismissal but completed confirmations can close',async()=>{
 await mount({busy:true});open();api.close();api.gesture.handlers.onStart();api.gesture.handlers.onUpdate({translationY:180});api.gesture.handlers.onEnd({translationY:180,velocityY:1000});finish();expect(dismiss).not.toHaveBeenCalled();api.closeAfterAction();finish();expect(dismiss).toHaveBeenCalledTimes(1);
});
test('a drag started during entrance stays rejected after entrance completes',async()=>{
 await mount();api.onShow();api.onLayout({nativeEvent:{layout:{height:400}}});api.gesture.handlers.onStart();finish();api.gesture.handlers.onUpdate({translationY:200});api.gesture.handlers.onEnd({translationY:200,velocityY:1000});finish();expect(dismiss).not.toHaveBeenCalled();expect(api.sheetStyle.read().transform[0].translateY).toBe(0);
});
test('canceled sheet drag settles without dismissing',async()=>{
 await mount();open();api.gesture.handlers.onStart();api.gesture.handlers.onUpdate({translationY:160});api.gesture.handlers.onFinalize({},false);finish();expect(api.sheetStyle.read().transform[0].translateY).toBe(0);expect(dismiss).not.toHaveBeenCalled();
});
test('swipe preserves commit thresholds and waits for animation completion',async()=>{
 await mount({kind:'swipe'});const pan=api.gesture.handlers;pan.onStart();pan.onUpdate({translationX:-60});pan.onEnd({translationX:-60,velocityX:0});finish();expect(dismiss).not.toHaveBeenCalled();expect(api.style.read().transform[0].translateX).toBe(0);pan.onStart();pan.onUpdate({translationX:-120});pan.onEnd({translationX:-120,velocityX:0});expect(dismiss).not.toHaveBeenCalled();finish();expect(dismiss).toHaveBeenCalledTimes(1);
});
test('crop pan and pinch clamp to image bounds and publish only final pose',async()=>{
 await mount({kind:'crop'});const [pan,pinch]=api.gesture.gestures.map(g=>g.handlers);pan.onStart();pan.onUpdate({translationX:100,translationY:200});expect(api.read()).toEqual({x:0,y:50,zoom:1});expect(commit).not.toHaveBeenCalled();pan.onFinalize();expect(commit).toHaveBeenLastCalledWith(0,50,1);commit.mockClear();pinch.onStart();pinch.onUpdate({scale:10});expect(api.read().zoom).toBe(4);expect(commit).not.toHaveBeenCalled();pinch.onFinalize();expect(commit).toHaveBeenLastCalledWith(0,50,4);
});

test('hiding a closing sheet cancels its pending action and dismissal',async()=>{await mount();open();const action=jest.fn();api.close(action);await act(async()=>view.update(<Harness visible={false}/>));finish();expect(dismiss).not.toHaveBeenCalled();expect(action).not.toHaveBeenCalled();});
test('unmounted swipe rows do not dispatch a late removal',async()=>{await mount({kind:'swipe'});api.gesture.handlers.onStart();api.gesture.handlers.onEnd({translationX:-150,velocityX:0});await act(async()=>view.unmount());view=null;finish();expect(dismiss).not.toHaveBeenCalled();});

test('embedded warnings open after layout without a native modal and reopen after dismissal',async()=>{
 await mount({embedded:true});api.onLayout({nativeEvent:{layout:{height:220}}});finish();
 expect(api.sheetStyle.read().opacity).toBe(1);expect(api.sheetStyle.read().transform[0].translateY).toBe(0);
 api.close();finish();expect(dismiss).toHaveBeenCalledTimes(1);
 await act(async()=>view.update(<Harness embedded visible={false}/>));
 await act(async()=>view.update(<Harness embedded visible/>));
 api.onLayout({nativeEvent:{layout:{height:220}}});finish();
 expect(api.sheetStyle.read().opacity).toBe(1);expect(api.sheetStyle.read().transform[0].translateY).toBe(0);
});
