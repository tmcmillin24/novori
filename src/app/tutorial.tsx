import {Ionicons} from '@expo/vector-icons';
import {useLocalSearchParams,useRouter} from 'expo-router';
import {useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated,{FadeIn} from 'react-native-reanimated';
import {useNovoriTheme} from '../context/theme-context';
import ValidationWarningSheet from '../components/ValidationWarningSheet';
import {TUTORIAL_STEPS,finishTutorial} from '../lib/tutorial';

export default function TutorialScreen(){
 const {colors}=useNovoriTheme(),router=useRouter(),{welcome}=useLocalSearchParams<{welcome?:string}>();
 const {width,height}=useWindowDimensions(),wide=width>=750&&width>height,tablet=width>=600;
 const [index,setIndex]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const saving=useRef(false),scroll=useRef<ScrollView>(null),step=TUTORIAL_STEPS[index];
 const body={color:colors.secondaryText,fontFamily:'Inter_400Regular',fontSize:tablet?18:15,lineHeight:tablet?29:24} as const;
 function change(next:number){setIndex(next);scroll.current?.scrollTo({y:0,animated:false});}
 async function finish(){
  if(saving.current)return;saving.current=true;setBusy(true);
  try{
   await finishTutorial();
   if(welcome==='1')router.replace('/(tabs)');else if(router.canGoBack())router.back();else router.replace('/(tabs)');
  }catch{setError('Could not save your tutorial progress. Please check your connection and try again.');}
  finally{saving.current=false;setBusy(false);}
 }
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}} edges={['top','bottom','left','right']}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:tablet?32:20,minHeight:56}}>
   <Text style={{color:colors.gold,fontFamily:'Inter_700Bold',fontSize:12,letterSpacing:2}}>NOVORI</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="Skip tutorial" disabled={busy} onPress={finish} style={{minHeight:44,justifyContent:'center',paddingHorizontal:8}}><Text style={{color:colors.mutedText,fontFamily:'Inter_600SemiBold',fontSize:14}}>Skip</Text></Pressable>
  </View>
  <ScrollView ref={scroll} contentContainerStyle={{flexGrow:1,paddingHorizontal:tablet?32:20,paddingVertical:20,justifyContent:'center'}} showsVerticalScrollIndicator={false}>
   <Animated.View key={index} entering={FadeIn.duration(140)} style={{width:'100%',maxWidth:1100,alignSelf:'center',flexDirection:wide?'row':'column',gap:tablet?32:24}}>
    <View style={{flex:wide?1:undefined,backgroundColor:colors.elevated,borderWidth:1,borderColor:colors.border,borderRadius:28,minHeight:tablet?260:190,padding:28,justifyContent:'center',alignItems:'center',gap:18}}>
     <View style={{width:tablet?112:88,height:tablet?112:88,borderRadius:tablet?56:44,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.gold,alignItems:'center',justifyContent:'center'}}><Ionicons name={step.icon} size={tablet?50:38} color={colors.gold}/></View>
     <Text style={{color:colors.gold,fontFamily:'Inter_600SemiBold',fontSize:14}}>{step.tab}</Text>
    </View>
    <View style={{flex:wide?1.35:undefined,justifyContent:'center'}}>
     <Text style={{color:colors.gold,fontFamily:'Inter_600SemiBold',fontSize:12,letterSpacing:1,marginBottom:12}}>STEP {index+1} OF {TUTORIAL_STEPS.length}</Text>
     <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{color:colors.text,fontFamily:'PlayfairDisplay_700Bold',fontSize:tablet?36:29,lineHeight:tablet?45:37,marginBottom:16}}>{step.title}</Text>
     <Text style={body}>{step.description}</Text>
     <View style={{flexDirection:'row',gap:12,padding:16,marginTop:22,backgroundColor:colors.surface,borderRadius:16,borderWidth:1,borderColor:colors.border}}>
      <Ionicons name="sparkles-outline" size={20} color={colors.gold}/><Text style={{...body,flex:1,fontSize:tablet?15:13,lineHeight:tablet?24:21}}>{step.tip}</Text>
     </View>
    </View>
   </Animated.View>
  </ScrollView>
  <View style={{paddingHorizontal:tablet?32:20,paddingBottom:16,paddingTop:12,width:'100%',maxWidth:1100,alignSelf:'center'}}>
   <View accessibilityLabel={`Tutorial progress: ${index+1} of 10`} style={{flexDirection:'row',gap:6,marginBottom:20}}>{TUTORIAL_STEPS.map((_,n)=><View key={n} style={{flex:1,height:4,borderRadius:2,backgroundColor:n<=index?colors.gold:colors.border}}/>)}</View>
   <View style={{flexDirection:'row',gap:12}}>
    {index>0?<Pressable accessibilityRole="button" accessibilityLabel="Previous tutorial step" disabled={busy} onPress={()=>change(index-1)} style={{minHeight:50,paddingHorizontal:20,justifyContent:'center',alignItems:'center',borderRadius:14,borderWidth:1,borderColor:colors.border}}><Text style={{color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:14}}>Back</Text></Pressable>:null}
    <Pressable accessibilityRole="button" accessibilityLabel={index===9?'Finish tutorial':'Next tutorial step'} disabled={busy} onPress={()=>index===9?void finish():change(index+1)} style={{flex:1,minHeight:50,justifyContent:'center',alignItems:'center',backgroundColor:colors.gold,borderRadius:14,opacity:busy ? 0.6 : 1}}>{busy?<ActivityIndicator color={colors.background}/>:<Text style={{color:colors.background,fontFamily:'Inter_700Bold',fontSize:15}}>{index===9?'Start exploring':'Next'}</Text>}</Pressable>
   </View>
  </View>
  <ValidationWarningSheet visible={!!error} title="Could not save progress" message={error} onDismiss={()=>setError('')}/>
 </SafeAreaView>;
}
