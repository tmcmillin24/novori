import {useCallback,useRef,type RefObject} from 'react';
import {Platform,type ScrollView} from 'react-native';
import {useFocusEffect} from 'expo-router';

/** Hide the native modal for navigation without clearing its React state. */
export function useCommentSheetContinuation(setVisible:(visible:boolean)=>void,scroll:RefObject<ScrollView|null>,prepareResume?:()=>void){
  const suspended=useRef(false);
  const pending=useRef<null|(()=>void)>(null);
  const offset=useRef(0);
  const navigationQueued=useRef(false);
  useFocusEffect(useCallback(()=>{if(suspended.current && !pending.current){prepareResume?.();setVisible(true);}},[setVisible,prepareResume]));
  function queueNavigation(){if(navigationQueued.current || !pending.current)return;navigationQueued.current=true;requestAnimationFrame(()=>{navigationQueued.current=false;navigate();});}
  function navigate(){const action=pending.current;pending.current=null;action?.();}
  return {
    suspend(action:()=>void){suspended.current=true;pending.current=action;setVisible(false);if(Platform.OS!=='ios')queueNavigation();},
    onDismiss(){if(!suspended.current)return false;queueNavigation();return true;},
    onShow(){if(!suspended.current)return false;suspended.current=false;requestAnimationFrame(()=>scroll.current?.scrollTo({y:offset.current,animated:false}));return true;},
    onScroll(y:number){offset.current=y;},
    reset(){offset.current=0;},
  };
}
