import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname,useRouter} from 'expo-router';
import {Keyboard,View,useWindowDimensions,type ViewProps} from 'react-native';
import {TUTORIAL_STEPS,finishTutorial} from '../lib/tutorial';
export type TutorialBounds={x:number;y:number;width:number;height:number;radius?:number};
type TourContext={active:boolean;index:number;step:typeof TUTORIAL_STEPS[number];pathname:string;bounds:TutorialBounds|null;busy:boolean;error:string;start:(automatic?:boolean)=>void;next:()=>void;back:()=>void;finish:()=>Promise<void>;clearError:()=>void;measure:(id:string,bounds:TutorialBounds)=>void};
const Context=createContext<TourContext|null>(null);
export function useTutorial(){return useContext(Context);}
export function TutorialBackground({children}:{children:ReactNode}){
 const tour=useTutorial();
 return <View style={{flex:1}} accessibilityElementsHidden={!!tour?.active} importantForAccessibility={tour?.active?'no-hide-descendants':'auto'}>{children}</View>;
}
export function TutorialProvider({children}:{children:ReactNode}){
 const router=useRouter(),pathname=usePathname();
 const {width,height}=useWindowDimensions();
 const [run,setRun]=useState<{index:number;automatic:boolean}|null>(null),[bounds,setBounds]=useState<TutorialBounds|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const frames=useRef(new Map<string,{path:string;width:number;height:number;rect:TutorialBounds}>()),live=useRef({active:false,anchor:''});
 const saving=useRef(false),step=TUTORIAL_STEPS[run?.index??0];
 live.current={active:!!run,anchor:step.anchor};
 useEffect(()=>{frames.current.clear();setBounds(null);},[width,height]);
 const start=useCallback((automatic=false)=>{Keyboard.dismiss();frames.current.clear();setBounds(null);setError('');setRun({index:0,automatic});router.replace('/(tabs)');},[router]);
 useEffect(()=>{if(run&&pathname!=='/tutorial'&&pathname!==step.path)router.navigate(step.route);},[run,step,pathname,router]);
 const measure=useCallback((id:string,rect:TutorialBounds)=>{
  if(!live.current.active||rect.width<=0||rect.height<=0)return;
  frames.current.set(id,{path:pathname,width,height,rect});
  if(id!==live.current.anchor)return;
  const target=TUTORIAL_STEPS.find(item=>item.anchor===id);
  if(target?.path!==pathname)return;
  setBounds(old=>old&&Math.abs(old.x-rect.x)<1&&Math.abs(old.y-rect.y)<1&&Math.abs(old.width-rect.width)<1&&Math.abs(old.height-rect.height)<1?old:rect);
 },[pathname,width,height]);
 async function finish(){
  if(saving.current||!run)return;saving.current=true;setBusy(true);
  try{await finishTutorial();setRun(null);setBounds(null);router.navigate(run.automatic?'/(tabs)':'/settings');}
  catch{setError('Could not save your tutorial progress. Please check your connection and try again.');}
  finally{saving.current=false;setBusy(false);}
 }
 function change(index:number){if(busy||!run)return;const next=TUTORIAL_STEPS[index],cached=frames.current.get(next.anchor);
  // Creation cards scroll between steps, so their frames must settle again.
  setBounds(!next.anchor.startsWith('create-')&&next.path===pathname&&cached?.path===pathname&&cached.width===width&&cached.height===height?cached.rect:null);setRun({...run,index});}
 return <Context.Provider value={{active:!!run,index:run?.index??0,step,pathname,bounds,busy,error,start,next:()=>run&&run.index===TUTORIAL_STEPS.length-1?void finish():change((run?.index??0)+1),back:()=>change(Math.max(0,(run?.index??0)-1)),finish,clearError:()=>setError(''),measure}}>{children}</Context.Provider>;
}
/** Attach to the actual native control; its measured frame follows screen size and rotation. */
export function useTutorialTarget(id:string,radius=0){
 const context=useTutorial(),ref=useRef<View>(null),{width,height}=useWindowDimensions();
 const targetPath=TUTORIAL_STEPS.find(step=>step.anchor===id)?.path;
 const enabled=!!context?.active&&(id.startsWith('tab-')||context.pathname===targetPath),current=enabled&&context?.step.anchor===id;
 const activeTarget=useRef('');activeTarget.current=enabled?id:'';
 const register=context?.measure,candidate=useRef<TutorialBounds|null>(null),settleFrame=useRef<number|null>(null);
 const measure=useCallback(()=>{
  if(enabled)ref.current?.measureInWindow((x,y,w,h)=>{
   if(activeTarget.current!==id)return;
   if(x>=0&&y>=0&&x<width&&y<height&&w>0&&h>0){
    const rect={x,y,width:w,height:h,radius},old=candidate.current;
    candidate.current=rect;
    if(old&&Math.abs(old.x-x)<1&&Math.abs(old.y-y)<1&&Math.abs(old.width-w)<1&&Math.abs(old.height-h)<1)register?.(id,rect);
    else settleFrame.current=requestAnimationFrame(measure);
   }
  });
 },[enabled,id,register,width,height,radius]);
 useEffect(()=>{if(!enabled){candidate.current=null;return;}measure();const timer=current?setInterval(measure,180):null;return()=>{if(settleFrame.current!==null)cancelAnimationFrame(settleFrame.current);if(timer!==null)clearInterval(timer);};},[enabled,current,measure]);
 const trackMotion=useCallback(()=>{
  if(!current)return;
  ref.current?.measureInWindow((x,y,w,h)=>{
   if(activeTarget.current===id&&w>0&&h>0)register?.(id,{x,y,width:w,height:h,radius});
  });
 },[current,id,register,radius]);
 return {ref,onLayout:measure,trackMotion};
}
export function TutorialTarget({id,children,...props}:ViewProps&{id:string;children:ReactNode}){
 const target=useTutorialTarget(id);
 return <View {...props} ref={target.ref} collapsable={false} onLayout={target.onLayout}>{children}</View>;
}
