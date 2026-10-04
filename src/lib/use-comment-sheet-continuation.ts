import {useCallback,useRef,type RefObject} from 'react';
import {Platform,type ScrollView} from 'react-native';
import {useFocusEffect} from 'expo-router';

/** Hide the native modal for navigation without clearing its React state. */
export function useCommentSheetContinuation(setVisible:(visible:boolean)=>void,scroll:RefObject<ScrollView|null>){
  const suspended=useRef(false);
  const pending=useRef<null|(()=>void)>(null);
  const offset=useRef(0);
  useFocusEffect(useCallback(()=>{if(suspended.current && !pending.current)setVisible(true);},[setVisible]));
  function navigate(){const action=pending.current;pending.current=null;action?.();}
  return {
    suspend(action:()=>void){suspended.current=true;pending.current=action;setVisible(false);if(Platform.OS!=='ios')requestAnimationFrame(navigate);},
    onDismiss(){if(!suspended.current)return false;navigate();return true;},
    onShow(){if(!suspended.current)return false;suspended.current=false;requestAnimationFrame(()=>scroll.current?.scrollTo({y:offset.current,animated:false}));return true;},
    onScroll(y:number){offset.current=y;},
    reset(){offset.current=0;},
  };
}
