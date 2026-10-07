import {useCallback,useEffect,useMemo,useRef} from 'react';
import {Gesture} from 'react-native-gesture-handler';
import {useAnimatedStyle,useSharedValue} from 'react-native-reanimated';
import {scheduleOnRN,scheduleOnUI} from 'react-native-worklets';

export function clampCropOffset(x:number,y:number,zoom:number,width:number,height:number,size:number){
  'worklet';
  const maxX=Math.max(0,(width*zoom-size)/2),maxY=Math.max(0,(height*zoom-size)/2);
  return {x:Math.max(-maxX,Math.min(maxX,x)),y:Math.max(-maxY,Math.min(maxY,y))};
}
type Options={geometry:{baseWidth:number;baseHeight:number}|null;size:number;maxZoom:number;x:number;y:number;zoom:number;busy:boolean;onCommit:(x:number,y:number,zoom:number)=>void};
/** Only the final pose crosses to React; pan/pinch frames stay on the UI thread. */
export function useUiCropGesture(options:Options){
  const {size,maxZoom,busy}=options,width=options.geometry?.baseWidth??size,height=options.geometry?.baseHeight??size;
  const x=useSharedValue(options.x),y=useSharedValue(options.y),zoom=useSharedValue(options.zoom);
  const startX=useSharedValue(0),startY=useSharedValue(0),startZoom=useSharedValue(1),panning=useSharedValue(false),pinching=useSharedValue(false);
  const callback=useRef(options.onCommit);callback.current=options.onCommit;
  const commit=useCallback((nextX:number,nextY:number,nextZoom:number)=>callback.current(nextX,nextY,nextZoom),[]);
  useEffect(()=>{
    scheduleOnUI((nextX:number,nextY:number,nextZoom:number)=>{
      'worklet';
      if(!panning.value && !pinching.value){x.value=nextX;y.value=nextY;zoom.value=nextZoom;}
    },options.x,options.y,options.zoom);
  },[options.x,options.y,options.zoom,x,y,zoom,panning,pinching]);
  const gesture=useMemo(()=>{
    const pan=Gesture.Pan().enabled(!busy).maxPointers(1).minDistance(0)
      .onStart(()=>{panning.value=true;startX.value=x.value;startY.value=y.value;})
      .onUpdate(event=>{
        if(pinching.value)return;
        const offset=clampCropOffset(startX.value+event.translationX,startY.value+event.translationY,zoom.value,width,height,size);
        x.value=offset.x;y.value=offset.y;
      })
      .onFinalize(()=>{panning.value=false;if(!pinching.value)scheduleOnRN(commit,x.value,y.value,zoom.value);});
    const pinch=Gesture.Pinch().enabled(!busy)
      .onStart(()=>{pinching.value=true;startZoom.value=zoom.value;})
      .onUpdate(event=>{
        zoom.value=Math.max(1,Math.min(maxZoom,startZoom.value*event.scale));
        const offset=clampCropOffset(x.value,y.value,zoom.value,width,height,size);x.value=offset.x;y.value=offset.y;
      })
      .onFinalize(()=>{pinching.value=false;if(!panning.value)scheduleOnRN(commit,x.value,y.value,zoom.value);});
    return Gesture.Simultaneous(pan,pinch);
  },[busy,maxZoom,width,height,size,x,y,zoom,startX,startY,startZoom,panning,pinching,commit]);
  const style=useAnimatedStyle(()=>({transform:[{translateX:x.value},{translateY:y.value},{scale:zoom.value}]}));
  const read=useCallback(()=>({x:x.value,y:y.value,zoom:zoom.value}),[x,y,zoom]);
  return {gesture,style,read};
}
