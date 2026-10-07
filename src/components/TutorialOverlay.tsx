import {Ionicons} from '@expo/vector-icons';
import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,BackHandler,Pressable,Text,View,useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated,{useSharedValue,useAnimatedStyle,withTiming,runOnJS} from 'react-native-reanimated';
import {TUTORIAL_STEPS} from '../lib/tutorial';
import {useTutorial} from '../context/tutorial-context';
import {useNovoriTheme} from '../context/theme-context';
import ValidationWarningSheet from './ValidationWarningSheet';

export function spotlightLayout(bounds:{x:number;y:number;width:number;height:number;radius?:number}|null,width:number,height:number,topInset:number,bottomInset:number,cardHeight:number,isTab:boolean,anchor:string=''){
 const target=bounds?{x:Math.max(0,Math.min(width,bounds.x)),y:Math.max(0,Math.min(height,bounds.y)),width:bounds.width,height:bounds.height,radius:Math.min(bounds.radius??(anchor==='tab-create'?27:anchor==='create-post'?22:anchor.startsWith('create-')?18:10),bounds.width/2,bounds.height/2)}:null;
 if(target){target.width=Math.min(target.width,width-target.x);target.height=Math.min(target.height,height-target.y);}
 const cardWidth=Math.min(360,width-32),below=target?target.y+target.height+16:topInset+80;
 const preferred=target&&below+cardHeight>height-bottomInset-16?target.y-cardHeight-16:below;
 return {target,card:{width:cardWidth,left:target?Math.max(16,Math.min(width-cardWidth-16,target.x+target.width/2-cardWidth/2)):(width-cardWidth)/2,top:Math.max(topInset+64,Math.min(height-bottomInset-cardHeight-16,preferred))}};
}
export default function TutorialOverlay(){
 const tour=useTutorial(),{colors}=useNovoriTheme(),{width,height}=useWindowDimensions(),insets=useSafeAreaInsets();
 const host=useRef<View>(null),[origin,setOrigin]=useState({x:0,y:0});
 const cardHeight=280,opacity=useSharedValue(0),ready=!!tour?.bounds;
 const [transitioning,setTransitioning]=useState(false),transitionLock=useRef(false),fromIndex=useRef(-1);
 const geometry=useSharedValue({x:0,y:0,width:0,height:0,radius:0});
 const retained=useRef<ReturnType<typeof spotlightLayout>['target']>(null);
 const spread=Math.max(width,height);
 const maskStyle=useAnimatedStyle(()=>({left:geometry.value.x-spread,top:geometry.value.y-spread,width:geometry.value.width+spread*2,height:geometry.value.height+spread*2,borderRadius:spread+geometry.value.radius}));
 const outlineStyle=useAnimatedStyle(()=>({left:geometry.value.x,top:geometry.value.y,width:geometry.value.width,height:geometry.value.height,borderRadius:geometry.value.radius}));
 const stepStyle=useAnimatedStyle(()=>({opacity:opacity.value}));
 useEffect(()=>{
  if(ready&&(!transitionLock.current||tour?.index!==fromIndex.current)){
   transitionLock.current=false;setTransitioning(false);opacity.value=withTiming(1,{duration:140});
  }else if(!ready)opacity.value=0;
 },[ready,tour?.index,opacity]);
 function commitStep(direction:number){
  if(direction>0&&tour?.index===TUTORIAL_STEPS.length-1){
   void tour.finish().finally(()=>{transitionLock.current=false;setTransitioning(false);opacity.value=withTiming(1,{duration:140});});
  }else if(direction>0)tour?.next();else tour?.back();
 }
 function advance(direction:number){
  if(!tour||tour.busy||!ready||transitionLock.current)return;
  transitionLock.current=true;fromIndex.current=tour.index;setTransitioning(true);
  opacity.value=withTiming(0,{duration:90},finished=>{if(finished)runOnJS(commitStep)(direction);});
 }

 useEffect(()=>{if(!tour?.active)return;const listener=BackHandler.addEventListener('hardwareBackPress',()=>{if(tour.index>0)advance(-1);else void tour.finish();return true;});return()=>listener.remove();},[tour?.active,tour?.index,tour?.busy]);
 const bounds=tour?.bounds?{...tour.bounds,x:tour.bounds.x-origin.x,y:tour.bounds.y-origin.y}:null;
 const layout=spotlightLayout(bounds,width,height,insets.top,insets.bottom,cardHeight,!!tour?.step.anchor.startsWith('tab-'),tour?.step.anchor);
 useEffect(()=>{
  if(layout.target){geometry.value=layout.target;retained.current=layout.target;}
  if(!tour?.active)retained.current=null;
 },[bounds?.x,bounds?.y,bounds?.width,bounds?.height,bounds?.radius,tour?.active,width,height]);
 if(!tour?.active)return null;
 const target=layout.target??retained.current,card=layout.card,lastStep=tour.index===TUTORIAL_STEPS.length-1;
 const dim='rgba(0,0,0,0.72)',label={color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:13} as const;
 return <View ref={host} onLayout={()=>host.current?.measureInWindow((x,y)=>setOrigin(old=>old.x===x&&old.y===y?old:{x,y}))} style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:1000}} accessibilityViewIsModal>
  <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={()=>{}} style={{position:'absolute',top:0,left:0,right:0,bottom:0}}/>
  {target?<>
   {/* A single rounded native border dims the outside without a square cutout at the corners. */}
   <Animated.View testID="tutorial-rounded-mask" pointerEvents="none" style={[maskStyle,{position:'absolute',borderWidth:spread,borderColor:dim}]}/>
   <Animated.View pointerEvents={ready&&!transitioning?'auto':'none'} style={[stepStyle,outlineStyle,{position:'absolute'}]}><Pressable accessibilityRole="button" accessibilityLabel="Continue from highlighted control" disabled={tour.busy||transitioning} onPress={()=>advance(1)} style={{flex:1,borderRadius:target.radius,borderWidth:2,borderColor:colors.gold}}>
    <View style={{position:'absolute',right:-2,top:-13,width:28,height:28,borderRadius:14,backgroundColor:colors.gold,alignItems:'center',justifyContent:'center'}}><Ionicons name={lastStep?'checkmark':'arrow-forward'} size={17} color={colors.background}/></View>
   </Pressable></Animated.View>
  </>:<View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:dim}}/>}
  <Pressable accessibilityRole="button" accessibilityLabel="Skip tutorial" disabled={tour.busy||transitioning} onPress={()=>void tour.finish()} style={{position:'absolute',right:16,top:insets.top+10,paddingHorizontal:16,minHeight:40,borderRadius:20,backgroundColor:colors.surface,justifyContent:'center'}}><Text style={label}>Skip tour</Text></Pressable>
  <Animated.View style={[stepStyle,{position:'absolute',...card,padding:20,borderRadius:22,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,shadowColor:'#000',shadowOpacity:.25,shadowRadius:18,shadowOffset:{width:0,height:6},elevation:12,minHeight:cardHeight}]}>
   <Text style={{color:colors.gold,fontFamily:'Inter_700Bold',fontSize:10,letterSpacing:1.5,marginBottom:8}}>YOUR NOVORI TOUR · {tour.index+1} / {TUTORIAL_STEPS.length}</Text>
   <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{color:colors.text,fontFamily:'PlayfairDisplay_700Bold',fontSize:23,lineHeight:29,marginBottom:10}}>{tour.step.title}</Text>
   <Text style={{color:colors.secondaryText,fontFamily:'Inter_400Regular',fontSize:14,lineHeight:22}}>{tour.step.description}</Text>
   {!target?<View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:12}}><ActivityIndicator size="small" color={colors.gold}/><Text style={{...label,color:colors.mutedText}}>Opening this screen…</Text></View>:null}
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:18}}>
    {tour.index>0?<Pressable accessibilityRole="button" accessibilityLabel="Previous tutorial step" disabled={tour.busy||transitioning} onPress={()=>advance(-1)} style={{minHeight:44,paddingHorizontal:8,justifyContent:'center'}}><Text style={label}>Back</Text></Pressable>:<View/>}
    <Pressable accessibilityRole="button" accessibilityLabel={lastStep?'Finish tutorial':'Next tutorial step'} disabled={tour.busy||transitioning||!ready} onPress={()=>advance(1)} style={{minHeight:44,paddingHorizontal:18,borderRadius:13,backgroundColor:colors.gold,flexDirection:'row',alignItems:'center',gap:8,opacity:(tour.busy||!ready) ? 0.5 : 1}}>{tour.busy?<ActivityIndicator color={colors.background}/>:<><Text style={{...label,color:colors.background}}>{lastStep?'Finish':'Next'}</Text><Ionicons name={lastStep?'checkmark':'arrow-forward'} size={17} color={colors.background}/></>}</Pressable>
   </View>
  </Animated.View>
  <ValidationWarningSheet visible={!!tour.error} title="Could not save progress" message={tour.error} onDismiss={tour.clearError}/>
 </View>;
}
