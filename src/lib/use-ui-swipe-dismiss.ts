import {useCallback,useEffect,useMemo,useRef} from 'react';
import {Gesture} from 'react-native-gesture-handler';
import {cancelAnimation,Easing,useAnimatedStyle,useSharedValue,withTiming} from 'react-native-reanimated';
import {scheduleOnRN} from 'react-native-worklets';

export function useUiSwipeDismiss(width:number,onDismiss:()=>void,minDistance=92,maxDistance=118,widthRatio=0.29){
  const x=useSharedValue(0),removing=useSharedValue(false),active=useSharedValue(false);
  const callback=useRef(onDismiss);callback.current=onDismiss;
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;cancelAnimation(x);};},[x]);
  const done=useCallback(()=>{if(alive.current)callback.current();},[]);
  const gesture=useMemo(()=>Gesture.Pan().activeOffsetX(-6).failOffsetY([-18,18])
    .onStart(()=>{active.value=!removing.value;if(active.value)cancelAnimation(x);})
    .onUpdate(event=>{if(active.value)x.value=Math.max(-Math.max(width,360),Math.min(0,event.translationX));})
    .onEnd(event=>{
      if(!active.value)return;active.value=false;
      const distance=Math.abs(Math.min(0,event.translationX));
      const threshold=Math.min(maxDistance,Math.max(minDistance,width*widthRatio));
      if(distance>=threshold || (distance>=48 && event.velocityX<=-620)){
        removing.value=true;
        x.value=withTiming(-Math.max(width,360),{duration:205,easing:Easing.bezier(0.22,1,0.36,1)},finished=>{if(finished)scheduleOnRN(done);});
      }else x.value=withTiming(0,{duration:190,easing:Easing.bezier(0.22,1,0.36,1)});
    })
    .onFinalize((_event,success)=>{if(!success && active.value){active.value=false;x.value=withTiming(0,{duration:190});}}),
  [width,minDistance,maxDistance,widthRatio,x,removing,active,done]);
  const style=useAnimatedStyle(()=>({transform:[{translateX:x.value}]}));
  return {gesture,style};
}
