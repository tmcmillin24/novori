import {useCallback,useEffect,useMemo,useRef} from 'react';
import {Keyboard} from 'react-native';
import {Gesture} from 'react-native-gesture-handler';
import {cancelAnimation,Easing,runOnJS,useAnimatedStyle,useSharedValue,withTiming} from 'react-native-reanimated';
import {resolveCommentSheetSnap,type CommentSheetSnap} from './comment-sheet-snap';

const enter=Easing.bezier(0.22,1,0.36,1);
const exit=Easing.bezier(0.32,0,0.67,1);
type Options={partial:number;full:number;keyboardVisible:boolean;onSettled:(height:number,snap:CommentSheetSnap)=>void;onDragDismiss:(height:number)=>void};

/** Sheet frames and drag updates stay on the UI thread, independent of Feed rendering. */
export function useCommentSheetMotion(options:Options){
  const {partial,full}=options;
  const callbacks=useRef(options);callbacks.current=options;
  const height=useSharedValue(0),translateY=useSharedValue(0),backdrop=useSharedValue(0);
  const moving=useSharedValue(false),fullSnap=useSharedValue(false),startHeight=useSharedValue(0),keyboardLock=useSharedValue(false);
  const dragging=useSharedValue(false);
  const keyboardVisible=useSharedValue(options.keyboardVisible);
  useEffect(()=>{keyboardVisible.value=options.keyboardVisible;},[options.keyboardVisible,keyboardVisible]);
  const settled=useCallback((value:number,isFull:boolean)=>callbacks.current.onSettled(value,isFull?'full':'partial'),[]);
  const dragDismiss=useCallback((value:number)=>callbacks.current.onDragDismiss(value),[]);
  const dismissKeyboard=useCallback(()=>Keyboard.dismiss(),[]);
  const stop=useCallback(()=>{cancelAnimation(height);cancelAnimation(translateY);cancelAnimation(backdrop);moving.value=false;dragging.value=false;},[height,translateY,backdrop,moving,dragging]);
  useEffect(()=>stop,[stop]);
  const prepare=useCallback((value:number,snap:CommentSheetSnap='partial')=>{
    stop();height.value=value;translateY.value=value;backdrop.value=0;fullSnap.value=snap==='full';moving.value=true;
  },[stop,height,translateY,backdrop,fullSnap,moving]);
  const open=useCallback((done:()=>void)=>{
    moving.value=true;
    backdrop.value=withTiming(1,{duration:180,easing:Easing.out(Easing.cubic)});
    translateY.value=withTiming(0,{duration:285,easing:enter},finished=>{
      if(finished){moving.value=false;runOnJS(done)();}
    });
  },[moving,backdrop,translateY]);
  const close=useCallback((done:()=>void)=>{
    cancelAnimation(height);moving.value=true;
    backdrop.value=withTiming(0,{duration:210,easing:Easing.in(Easing.cubic)});
    translateY.value=withTiming(height.value,{duration:235,easing:exit},finished=>{
      if(finished){moving.value=false;runOnJS(done)();}
    });
  },[height,moving,backdrop,translateY]);
  const snap=useCallback((target:CommentSheetSnap)=>{
    const value=target==='full'?full:partial;
    fullSnap.value=target==='full';moving.value=true;
    height.value=withTiming(value,{duration:target==='full'?235:220,easing:enter},finished=>{
      if(finished){moving.value=false;runOnJS(settled)(value,target==='full');}
    });
  },[full,partial,fullSnap,moving,height,settled]);
  const gestures=useMemo(()=>{
    const makeGesture=()=>Gesture.Pan().activeOffsetY([-4,4]).failOffsetX([-20,20])
      .onStart(()=>{
        dragging.value=false;
        if(moving.value)return;
        dragging.value=true;
        cancelAnimation(height);startHeight.value=height.value;
        keyboardLock.value=keyboardVisible.value;
        if(keyboardLock.value)runOnJS(dismissKeyboard)();
      })
      .onUpdate(event=>{
        if(!dragging.value || moving.value || keyboardLock.value)return;
        height.value=Math.max(0,Math.min(full,startHeight.value-event.translationY));
      })
      .onEnd(event=>{
        if(!dragging.value || moving.value)return;
        dragging.value=false;
        const currentSnap=fullSnap.value?'full':'partial';
        const target=keyboardLock.value?currentSnap:resolveCommentSheetSnap(currentSnap,height.value,partial,full,event.translationY,event.velocityY);
        keyboardLock.value=false;
        if(target==='dismiss'){moving.value=true;runOnJS(dragDismiss)(height.value);return;}
        const value=target==='full'?full:partial;
        fullSnap.value=target==='full';moving.value=true;
        height.value=withTiming(value,{duration:target==='full'?235:220,easing:enter},finished=>{
          if(finished){moving.value=false;runOnJS(settled)(value,target==='full');}
        });
      })
      .onFinalize((_event,success)=>{
        if(success || !dragging.value || moving.value)return;
        dragging.value=false;
        keyboardLock.value=false;
        const isFull=Math.abs(height.value-full)<Math.abs(height.value-partial);
        const value=isFull?full:partial;
        fullSnap.value=isFull;moving.value=true;
        height.value=withTiming(value,{duration:220,easing:enter},finished=>{
          if(finished){moving.value=false;runOnJS(settled)(value,isFull);}
        });
      });
    return {header:makeGesture(),left:makeGesture(),right:makeGesture()};
  },[full,partial,height,moving,dragging,startHeight,keyboardLock,keyboardVisible,fullSnap,dismissKeyboard,dragDismiss,settled]);
  const sheetStyle=useAnimatedStyle(()=>({height:height.value}));
  const entranceStyle=useAnimatedStyle(()=>({transform:[{translateY:translateY.value}]}));
  const backdropStyle=useAnimatedStyle(()=>({opacity:backdrop.value}));
  return {prepare,open,close,snap,stop,gestures,sheetStyle,entranceStyle,backdropStyle};
}
