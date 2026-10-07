import {Ionicons} from '@expo/vector-icons';
import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,BackHandler,Pressable,Text,View,useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TUTORIAL_STEPS} from '../lib/tutorial';
import {useTutorial} from '../context/tutorial-context';
import {useNovoriTheme} from '../context/theme-context';
import ValidationWarningSheet from './ValidationWarningSheet';

export function spotlightLayout(bounds:{x:number;y:number;width:number;height:number;radius?:number}|null,width:number,height:number,topInset:number,bottomInset:number,cardHeight:number,isTab:boolean,anchor:string=''){
 const target=bounds?{x:Math.max(0,Math.min(width,bounds.x)),y:Math.max(0,Math.min(height,bounds.y)),width:bounds.width,height:bounds.height,radius:Math.min(bounds.radius??(anchor==='tab-create'?27:anchor==='create-post'?22:anchor.startsWith('create-')?18:10),bounds.width/2,bounds.height/2)}:null;
 if(target){target.width=Math.min(target.width,width-target.x);target.height=Math.min(target.height,height-target.y);}
 const cardWidth=Math.min(width>height?600:360,width-32),gap=16,minTop=topInset+64,maxBottom=height-bottomInset-16;
 const left=target?Math.max(16,Math.min(width-cardWidth-16,target.x+target.width/2-cardWidth/2)):(width-cardWidth)/2;
 const below=target?target.y+target.height+gap:minTop,above=target?target.y-cardHeight-gap:minTop;
 let card={width:cardWidth,left,top:below};
 if(target&&below+cardHeight>maxBottom){
  if(above>=minTop)card.top=above;
  else if(target.x+target.width+gap+cardWidth<=width-16)card={width:cardWidth,left:target.x+target.width+gap,top:Math.max(minTop,Math.min(maxBottom-cardHeight,target.y))};
  else if(target.x-gap-cardWidth>=16)card={width:cardWidth,left:target.x-gap-cardWidth,top:Math.max(minTop,Math.min(maxBottom-cardHeight,target.y))};
  else card.top=Math.max(minTop,above);
 }
 return {target,card};
}
/** Bounded rectangles cover the whole window; clipped corner rings preserve the rounded hole. */
export function spotlightMaskPieces(t:{x:number;y:number;width:number;height:number;radius:number},width:number,height:number){
 const r=t.radius;
 return {panels:[{left:0,top:0,width,height:t.y},{left:0,top:t.y+t.height,width,height:Math.max(0,height-t.y-t.height)},{left:0,top:t.y,width:t.x,height:t.height},{left:t.x+t.width,top:t.y,width:Math.max(0,width-t.x-t.width),height:t.height}],corners:r>0?[{left:t.x,top:t.y,x:-r,y:-r},{left:t.x+t.width-r,top:t.y,x:-2*r,y:-r},{left:t.x,top:t.y+t.height-r,x:-r,y:-2*r},{left:t.x+t.width-r,top:t.y+t.height-r,x:-2*r,y:-2*r}]:[]};
}
export default function TutorialOverlay(){
 const tour=useTutorial(),{colors}=useNovoriTheme(),{width,height}=useWindowDimensions(),insets=useSafeAreaInsets();
 const host=useRef<View>(null),[origin,setOrigin]=useState({x:0,y:0});
 const settled=useRef<{path:string;index:number;step:typeof TUTORIAL_STEPS[number];bounds:NonNullable<ReturnType<typeof useTutorial>>['bounds'];width:number;height:number}|null>(null);
 const cardHeight=width>height?220:280,ready=!!tour?.bounds;

 function advance(direction:number){
  if(!tour||tour.busy||!ready)return;
  if(direction>0)tour.next();else tour.back();
 }
 useEffect(()=>{if(!tour?.active)return;const listener=BackHandler.addEventListener('hardwareBackPress',()=>{if(tour.index>0)advance(-1);else void tour.finish();return true;});return()=>listener.remove();},[tour?.active,tour?.index,tour?.busy,ready]);
 if(tour?.bounds)settled.current={path:tour.pathname,index:tour.index,step:tour.step,bounds:tour.bounds,width,height};
 if(!tour?.active)settled.current=null;
 const previous=settled.current,keepPrevious=!ready&&previous?.path===tour?.pathname&&previous?.path===tour?.step.path&&previous?.width===width&&previous?.height===height;
 const display=keepPrevious?previous:tour,displayBounds=display?.bounds;
 const bounds=displayBounds?{...displayBounds,x:displayBounds.x-origin.x,y:displayBounds.y-origin.y}:null;
 const layout=spotlightLayout(bounds,width,height,insets.top,insets.bottom,cardHeight,!!display?.step.anchor.startsWith('tab-'),display?.step.anchor);
 if(!tour?.active)return null;
 const target=layout.target,card=layout.card,lastStep=display?.index===TUTORIAL_STEPS.length-1;
 const dim='rgba(0,0,0,0.72)',label={color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:13} as const;
 return <View ref={host} onLayout={()=>host.current?.measureInWindow((x,y)=>setOrigin(old=>old.x===x&&old.y===y?old:{x,y}))} style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:1000}} accessibilityViewIsModal>
  <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={()=>{}} style={{position:'absolute',top:0,left:0,right:0,bottom:0}}/>
  {target?<>
   <View testID="tutorial-rounded-mask" pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0}}>
    {spotlightMaskPieces(target,width,height).panels.map((panel,index)=><View key={'panel'+index} style={{position:'absolute',...panel,backgroundColor:dim}}/>)}
    {spotlightMaskPieces(target,width,height).corners.map((corner,index)=><View key={'corner'+index} style={{position:'absolute',left:corner.left,top:corner.top,width:target.radius,height:target.radius,overflow:'hidden'}}><View style={{position:'absolute',left:corner.x,top:corner.y,width:target.radius*4,height:target.radius*4,borderRadius:target.radius*2,borderWidth:target.radius,borderColor:dim}}/></View>)}
   </View>
   <View style={{position:'absolute',left:target.x,top:target.y,width:target.width,height:target.height}}><Pressable accessibilityRole="button" accessibilityLabel="Continue from highlighted control" disabled={tour.busy||!ready} onPress={()=>advance(1)} style={{flex:1,borderRadius:target.radius,borderWidth:2,borderColor:colors.gold}}>
    <View style={{position:'absolute',right:-2,top:-13,width:28,height:28,borderRadius:14,backgroundColor:colors.gold,alignItems:'center',justifyContent:'center'}}><Ionicons name={lastStep?'checkmark':'arrow-forward'} size={17} color={colors.background}/></View>
   </Pressable></View>
  </>:<View testID="tutorial-preparing-screen" pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:colors.background}}><View style={{flex:1,backgroundColor:dim}}/></View>}
  <Pressable accessibilityRole="button" accessibilityLabel="Skip tutorial" disabled={tour.busy} onPress={()=>void tour.finish()} style={{position:'absolute',right:16,top:insets.top+10,paddingHorizontal:16,minHeight:40,borderRadius:20,backgroundColor:colors.surface,justifyContent:'center'}}><Text style={label}>Skip tour</Text></Pressable>
  {target?<View testID="tutorial-description-panel" style={{position:'absolute',...card,padding:20,borderRadius:22,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,shadowColor:'#000',shadowOpacity:.25,shadowRadius:18,shadowOffset:{width:0,height:6},elevation:12,height:cardHeight}}>
   <Text style={{color:colors.gold,fontFamily:'Inter_700Bold',fontSize:10,letterSpacing:1.5,marginBottom:8}}>YOUR NOVORI TOUR · {(display?.index??0)+1} / {TUTORIAL_STEPS.length}</Text>
   <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{color:colors.text,fontFamily:'PlayfairDisplay_700Bold',fontSize:23,lineHeight:29,marginBottom:10}}>{display?.step.title}</Text>
   <Text style={{color:colors.secondaryText,fontFamily:'Inter_400Regular',fontSize:14,lineHeight:22}}>{display?.step.description}</Text>

   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,position:'absolute',bottom:20,left:20,right:20}}>
    {(display?.index??0)>0?<Pressable accessibilityRole="button" accessibilityLabel="Previous tutorial step" disabled={tour.busy||!ready} onPress={()=>advance(-1)} style={{minHeight:44,paddingHorizontal:8,justifyContent:'center'}}><Text style={label}>Back</Text></Pressable>:<View/>}
    <Pressable accessibilityRole="button" accessibilityLabel={lastStep?'Finish tutorial':'Next tutorial step'} disabled={tour.busy||!ready} onPress={()=>advance(1)} style={{minHeight:44,paddingHorizontal:18,borderRadius:13,backgroundColor:colors.gold,flexDirection:'row',alignItems:'center',gap:8,opacity:tour.busy ? 0.5 : 1}}>{tour.busy?<ActivityIndicator color={colors.background}/>:<><Text style={{...label,color:colors.background}}>{lastStep?'Finish':'Next'}</Text><Ionicons name={lastStep?'checkmark':'arrow-forward'} size={17} color={colors.background}/></>}</Pressable>
   </View>
  </View>:null}
  <ValidationWarningSheet visible={!!tour.error} title="Could not save progress" message={tour.error} onDismiss={tour.clearError}/>
 </View>;
}
