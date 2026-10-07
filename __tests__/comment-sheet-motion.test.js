import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {Keyboard} from 'react-native';
import {useCommentSheetMotion} from '../src/lib/use-comment-sheet-motion';
import {resolveCommentSheetSnap,getCommentSheetBounds} from '../src/lib/comment-sheet-snap';
let mockAnimations=[],mockFrames=[];
jest.mock('react-native',()=>({Keyboard:{dismiss:jest.fn()},Platform:{OS:'ios',select:value=>value.ios??value.default},TurboModuleRegistry:{get:()=>null}}));
jest.mock('react-native-worklets',()=>({scheduleOnRN:(callback,...args)=>callback(...args),scheduleOnUI:(callback,...args)=>callback(...args)}));
jest.mock('react-native-reanimated',()=>({
 Easing:{bezier:()=>()=>0,out:value=>value,in:value=>value,cubic:()=>0},
 useSharedValue:value=>require('react').useRef({value}).current,
 useAnimatedStyle:read=>({read}),runOnJS:callback=>callback,runOnUI:callback=>callback,cancelAnimation:jest.fn(),
 withTiming:(value,config,callback)=>{mockAnimations.push({value,config,callback});return value;},
}));
jest.mock('react-native-gesture-handler',()=>({Gesture:{Pan:()=>{
 const gesture={handlers:{}};
 for(const name of ['activeOffsetY','failOffsetX','onStart','onUpdate','onEnd','onFinalize'])gesture[name]=callback=>{gesture.handlers[name]=callback;return gesture;};
 return gesture;
}}}));
let view,api;
const onSettled=jest.fn(),onDragDismiss=jest.fn();
function Harness({keyboardVisible=false,partial=700,full=850}){api=useCommentSheetMotion({partial,full,keyboardVisible,onSettled,onDragDismiss});return null;}
async function mount(keyboardVisible=false){await act(async()=>{view=renderer.create(<Harness keyboardVisible={keyboardVisible}/>);});}
function finish(){const frames=mockFrames;mockFrames=[];frames.forEach(callback=>callback());const pending=mockAnimations;mockAnimations=[];pending.forEach(animation=>animation.callback?.(true));}
function open(){api.prepare(700);api.open(()=>{});finish();}
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;mockAnimations=[];mockFrames=[];global.requestAnimationFrame=callback=>{mockFrames.push(callback);return mockFrames.length;};jest.clearAllMocks();});
afterEach(async()=>{await act(async()=>view?.unmount());view=null;});
test('drag frames update shared height without calling JavaScript completion handlers; release snaps once',async()=>{
 await mount();open();const pan=api.gestures.header.handlers;pan.onStart();
 [-10,-30,-60].forEach(translationY=>pan.onUpdate({translationY}));
 expect(api.sheetStyle.read().height).toBe(760);expect(onSettled).not.toHaveBeenCalled();expect(onDragDismiss).not.toHaveBeenCalled();
 pan.onEnd({translationY:-60,velocityY:-500});pan.onFinalize({},true);expect(api.sheetStyle.read().height).toBe(850);finish();expect(onSettled).toHaveBeenCalledTimes(1);expect(onSettled).toHaveBeenCalledWith(850,'full');
});
test('a drag begun during entrance cannot start moving the sheet halfway through that entrance',async()=>{
 await mount();api.prepare(700);api.open(()=>{});const pan=api.gestures.header.handlers;pan.onStart();finish();pan.onUpdate({translationY:150});pan.onEnd({translationY:150,velocityY:0});pan.onFinalize({},true);expect(api.sheetStyle.read().height).toBe(700);expect(onDragDismiss).not.toHaveBeenCalled();expect(onSettled).not.toHaveBeenCalled();
});
test('keyboard dismissal consumes the drag and preserves the current snap',async()=>{
 await mount(true);open();const pan=api.gestures.left.handlers;pan.onStart();pan.onUpdate({translationY:200});expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);expect(api.sheetStyle.read().height).toBe(700);pan.onEnd({translationY:200,velocityY:1000});finish();expect(onDragDismiss).not.toHaveBeenCalled();expect(onSettled).toHaveBeenCalledWith(700,'partial');
});
test('a canceled native gesture settles to the nearest valid height',async()=>{
 await mount();open();const pan=api.gestures.right.handlers;pan.onStart();pan.onUpdate({translationY:-120});pan.onFinalize({},false);finish();expect(onSettled).toHaveBeenCalledWith(850,'full');
});
test('dismissal uses the current dragged height, while reopening preserves a restored full sheet',async()=>{
 await mount();open();const pan=api.gestures.header.handlers;pan.onStart();pan.onUpdate({translationY:160});pan.onEnd({translationY:160,velocityY:1100});expect(onDragDismiss).toHaveBeenCalledWith(540);
 const closed=jest.fn();api.close(closed);expect(closed).not.toHaveBeenCalled();expect(api.entranceStyle.read().transform[0].translateY).toBe(540);finish();expect(closed).toHaveBeenCalledTimes(1);
 api.prepare(850,'full');api.open(()=>{});finish();expect(api.sheetStyle.read().height).toBe(850);expect(api.entranceStyle.read().transform[0].translateY).toBe(0);
});
test.each([
 ['partial',700,0,0,'partial'],['partial',780,-80,-500,'full'],['partial',650,130,0,'dismiss'],
 ['full',850,0,0,'full'],['full',760,70,500,'partial'],['full',450,230,1100,'dismiss'],
])('keeps the existing %s snap thresholds', (snap,height,dy,velocity,target)=>expect(resolveCommentSheetSnap(snap,height,700,850,dy,velocity)).toBe(target));

test('opening first commits a fully offscreen sheet, then starts its continuous rise on the next UI frame',async()=>{
 await mount();api.prepare(700);const done=jest.fn();api.open(done);
 const topOfSheet=1000-api.sheetStyle.read().height+api.entranceStyle.read().transform[0].translateY;
 expect(topOfSheet).toBeGreaterThan(1000);expect(mockAnimations).toHaveLength(0);expect(done).not.toHaveBeenCalled();
 const frame=mockFrames.shift();frame();expect(mockAnimations).toHaveLength(2);expect(api.entranceStyle.read().transform[0].translateY).toBe(0);finish();expect(done).toHaveBeenCalledTimes(1);
});
test('navigation cancellation before the first frame cannot restart an opening animation',async()=>{
 await mount();api.prepare(700);const done=jest.fn();api.open(done);api.stop();finish();expect(mockAnimations).toHaveLength(0);expect(done).not.toHaveBeenCalled();
});

test('backdrop dismissal interrupts opening before its first frame without restarting entrance',async()=>{
 await mount();api.prepare(700);const opened=jest.fn(),closed=jest.fn();api.open(opened);api.close(closed);finish();expect(opened).not.toHaveBeenCalled();expect(closed).toHaveBeenCalledTimes(1);
});
test('an old close completion cannot dismiss a newly opened sheet',async()=>{
 await mount();open();const closed=jest.fn();api.close(closed);const oldClose=mockAnimations.at(-1).callback;
 api.prepare(850,'full');api.open(()=>{});oldClose(true);finish();expect(closed).not.toHaveBeenCalled();expect(api.sheetStyle.read().height).toBe(850);
});

 test.each(['partial','full'])('rotation resizes an open %s sheet, preserves its snap, and leaves dismissal operational',async snap=>{
 await mount();api.prepare(snap==='full'?850:700,snap);api.open(()=>{});finish();
 await act(async()=>view.update(<Harness partial={440} full={520}/>));
 expect(api.sheetStyle.read().height).toBe(snap==='full'?520:440);
 expect(api.entranceStyle.read().transform[0].translateY).toBe(0);
 expect(onSettled).toHaveBeenLastCalledWith(snap==='full'?520:440,snap);
 const closed=jest.fn();api.close(closed);finish();expect(closed).toHaveBeenCalledTimes(1);
 });
 test.each(['opening','closing'])('rotation during %s preserves its completion callback',async phase=>{
 await mount();api.prepare(700);const done=jest.fn();
 if(phase==='opening')api.open(done);else{api.open(()=>{});finish();api.close(done);}
 await act(async()=>view.update(<Harness partial={440} full={520}/>));
 expect(api.sheetStyle.read().height).toBe(440);finish();expect(done).toHaveBeenCalledTimes(1);
 });
 test('a conversation restored after rotation uses the new snap dimensions instead of saved portrait pixels',async()=>{
 await mount();api.prepare(850,'full');api.open(()=>{});finish();api.stop();
 await act(async()=>view.update(<Harness partial={440} full={520}/>));
 api.prepare(850,'full');api.open(()=>{});finish();expect(api.sheetStyle.read().height).toBe(520);
 });
 test('rotation cancels a live drag and restores a usable snap',async()=>{
 await mount();open();const oldGesture=api.gestures.header.handlers;oldGesture.onStart();oldGesture.onUpdate({translationY:-100});
 await act(async()=>view.update(<Harness partial={440} full={520}/>));oldGesture.onUpdate({translationY:-300});oldGesture.onEnd({translationY:-300,velocityY:-500});
 expect(api.sheetStyle.read().height).toBe(440);expect(onDragDismiss).not.toHaveBeenCalled();
 });
 test.each([[1133,24],[744,24],[1194,24],[834,24],[1366,24],[1024,24],[350,44],[240,24]])('snap points fit window height %s and safe top %s', (height,inset)=>{
 const bounds=getCommentSheetBounds(height,inset);expect(bounds.full).toBeLessThanOrEqual(height-inset);expect(bounds.partial).toBeLessThanOrEqual(bounds.full);expect(bounds.partial).toBeGreaterThan(0);
 });
