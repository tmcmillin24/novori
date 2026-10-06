import {scheduleOnRN,scheduleOnUI} from 'react-native-worklets';
import {useCallback,useEffect,useMemo,useRef} from 'react';
import {Keyboard} from 'react-native';
import {Gesture} from 'react-native-gesture-handler';
import {cancelAnimation,Easing,useAnimatedStyle,useSharedValue,withTiming} from 'react-native-reanimated';
import {resolveCommentSheetSnap,type CommentSheetSnap} from './comment-sheet-snap';

const enter=Easing.bezier(0.22,1,0.36,1);
const opening=Easing.bezier(0.32,0,0.18,1);
const exit=Easing.bezier(0.32,0,0.67,1);
type Options={partial:number;full:number;keyboardVisible:boolean;onSettled:(height:number,snap:CommentSheetSnap)=>void;onDragDismiss:(height:number)=>void};

/** Sheet frames and drag updates stay on the UI thread, independent of Feed rendering. */
export function useCommentSheetMotion(options:Options){
  const {partial,full}=options;
  const callbacks=useRef(options);callbacks.current=options;
  const height=useSharedValue(0),translateY=useSharedValue(0),backdrop=useSharedValue(0);
  const moving=useSharedValue(false),fullSnap=useSharedValue(false),startHeight=useSharedValue(0),keyboardLock=useSharedValue(false);
  const dragging=useSharedValue(false);
  const entranceGeneration=useSharedValue(0);
  const keyboardVisible=useSharedValue(options.keyboardVisible);
  useEffect(()=>{keyboardVisible.value=options.keyboardVisible;},[options.keyboardVisible,keyboardVisible]);
  const settled=useCallback((value:number,isFull:boolean)=>callbacks.current.onSettled(value,isFull?'full':'partial'),[]);
  const dragDismiss=useCallback((value:number)=>callbacks.current.onDragDismiss(value),[]);
  const dismissKeyboard=useCallback(()=>Keyboard.dismiss(),[]);
  const stop=useCallback(()=>{entranceGeneration.value+=1;cancelAnimation(height);cancelAnimation(translateY);cancelAnimation(backdrop);moving.value=false;dragging.value=false;},[height,translateY,backdrop,moving,dragging,entranceGeneration]);
  useEffect(()=>stop,[stop]);
  const prepare=useCallback((value:number,snap:CommentSheetSnap='partial')=>{
    stop();height.value=value;translateY.value=value;backdrop.value=0;fullSnap.value=snap==='full';moving.value=true;
  },[stop,height,translateY,backdrop,fullSnap,moving]);
  const open=useCallback((done:()=>void)=>{
    scheduleOnUI(()=>{
      'worklet';
      const generation=++entranceGeneration.value;
      moving.value=true;
      // Commit the fully hidden start before advancing the animation clock.
      // The extra pixel keeps the rounded top edge below the window boundary.
      translateY.value=height.value+1;
      backdrop.value=0;
      requestAnimationFrame(()=>{
        if(generation!==entranceGeneration.value)return;
        backdrop.value=withTiming(1,{duration:180,easing:Easing.out(Easing.cubic)});
        translateY.value=withTiming(0,{duration:245,easing:opening},finished=>{
          if(finished && generation===entranceGeneration.value){moving.value=false;scheduleOnRN(done);}
        });
      });
    });
  },[moving,backdrop,translateY,height,entranceGeneration]);
  const close=useCallback((done:()=>void)=>{
    const generation=++entranceGeneration.value;
    cancelAnimation(height);cancelAnimation(translateY);cancelAnimation(backdrop);
    dragging.value=false;moving.value=true;
    backdrop.value=withTiming(0,{duration:210,easing:Easing.in(Easing.cubic)});
    translateY.value=withTiming(height.value,{duration:235,easing:exit},finished=>{
      if(finished && generation===entranceGeneration.value){moving.value=false;scheduleOnRN(done);}
    });
  },[height,moving,dragging,backdrop,translateY,entranceGeneration]);
  const snap=useCallback((target:CommentSheetSnap)=>{
    const value=target==='full'?full:partial;
    fullSnap.value=target==='full';moving.value=true;
    height.value=withTiming(value,{duration:target==='full'?235:220,easing:enter},finished=>{
      if(finished){moving.value=false;scheduleOnRN(settled,value,target==='full');}
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
        if(keyboardLock.value)scheduleOnRN(dismissKeyboard);
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
        if(target==='dismiss'){moving.value=true;scheduleOnRN(dragDismiss,height.value);return;}
        const value=target==='full'?full:partial;
        fullSnap.value=target==='full';moving.value=true;
        height.value=withTiming(value,{duration:target==='full'?235:220,easing:enter},finished=>{
          if(finished){moving.value=false;scheduleOnRN(settled,value,target==='full');}
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
          if(finished){moving.value=false;scheduleOnRN(settled,value,isFull);}
        });
      });
    return {header:makeGesture(),left:makeGesture(),right:makeGesture()};
  },[full,partial,height,moving,dragging,startHeight,keyboardLock,keyboardVisible,fullSnap,dismissKeyboard,dragDismiss,settled]);
  const sheetStyle=useAnimatedStyle(()=>({height:height.value}));
  const entranceStyle=useAnimatedStyle(()=>({transform:[{translateY:translateY.value}]}));
  const backdropStyle=useAnimatedStyle(()=>({opacity:backdrop.value}));
  return {prepare,open,close,snap,stop,gestures,sheetStyle,entranceStyle,backdropStyle};
}
