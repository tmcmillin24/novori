import { useNovoriTheme } from '../context/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { type StreakTier } from '../lib/reading-streak-tier';

import { streakCelebrationLayout } from '../lib/streak-celebration-layout';

const scenes = {
  3:  { kind:'embers', duration:1050, stage:84, glow:44 },
  7:  { kind:'flare', duration:1350, stage:92, glow:54 },
  14: { kind:'burst', duration:1700, stage:108, glow:65 },
  30: { kind:'crown', duration:2100, stage:122, glow:76 },
} as const;

type Milestone = {tier: StreakTier; days: number};

export default function ReadingStreakCelebration({ tier, days, region, onDismiss }: Milestone & {region: {width: number; height: number}; onDismiss: () => void}) {
  const { colors } = useNovoriTheme();
  const scene = scenes[tier.days];
  const { fontScale } = useWindowDimensions();
  const layout = streakCelebrationLayout(region.width, region.height, scene.stage, fontScale);
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const [motion, setMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', reduced => {
      changed = true;
      setMotion(!reduced);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (active && !changed) setMotion(!reduced);
    }, () => { if (active && !changed) setMotion(false); });
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (motion === null) return;
    if (!motion) {
      opacity.setValue(1);
      const timer = setTimeout(() => dismiss.current(), scene.duration + 800);
      return () => clearTimeout(timer);
    }
    progress.setValue(0);
    opacity.setValue(1);
    const sequence = Animated.sequence([
      Animated.timing(progress, {toValue:1, duration:scene.duration, easing:Easing.linear, useNativeDriver:true, isInteraction:false}),
      Animated.delay(750),
      Animated.timing(opacity, {toValue:0, duration:420, easing:Easing.inOut(Easing.cubic), useNativeDriver:true, isInteraction:false}),
    ]);
    sequence.start(({finished}) => { if (finished) dismiss.current(); });
    return () => sequence.stop();
  }, [motion, progress, opacity, scene.duration]);

  const crown = scene.kind === 'crown';
  const ringCount = scene.kind === 'embers' ? 0 : scene.kind === 'flare' ? 1 : 2;
  const flare = scene.kind === 'flare';
  const burst = scene.kind === 'burst';
  const peak = crown ? .37 : flare ? .23 : .31;
  return <Animated.View accessibilityViewIsModal style={[styles.banner,{backgroundColor:colors.elevated,borderColor:colors.gold,opacity}]}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.stage,{width:layout.stageWidth,height:layout.stageHeight}]}>
      <View style={[styles.stage,{width:scene.stage,height:88,transform:[{scale:layout.artScale}]}]}>
      <View style={[styles.glow,{width:scene.glow,height:scene.glow,backgroundColor:colors.gold,opacity:crown ? .16 : .10}]}/>
      {motion && <>
        {Array.from({length:ringCount}, (_, index) => {
          const start = (crown ? .22 : .11) + index*.15;
          return <Animated.View key={index} style={[styles.ring,{borderColor:colors.gold,
            opacity:progress.interpolate({inputRange:[0,start,start+.07,start+.4,1],outputRange:[0,0,.8,0,0]}),
            transform:[{scale:progress.interpolate({inputRange:[start,start+.4],outputRange:[.65,crown?2.85:2.4],extrapolate:'clamp'})}],
          }]}/>;
        })}
        {Array.from({length:tier.sparks}, (_, index) => {
          const angle = flare ? -Math.PI/2 + (index/(tier.sparks-1)-.5)*2.5 : index/tier.sparks*Math.PI*2;
          const distance = 26+(index%3)*7+(crown?9:burst?5:0);
          const x = scene.kind === 'embers' ? (index%3-1)*13 : Math.cos(angle)*distance;
          const y = scene.kind === 'embers' ? -25-index*4 : Math.sin(angle)*distance;
          const start = (crown ? .35 : burst ? .24 : .13) + (index%3)*.065;
          return <Animated.View key={index} style={[styles.spark,{
            opacity:progress.interpolate({inputRange:[0,start,start+.08,.92,1],outputRange:[0,0,1,.35,0]}),
            transform:[
              {translateX:progress.interpolate({inputRange:[start,.93],outputRange:[0,x],extrapolate:'clamp'})},
              {translateY:progress.interpolate({inputRange:[start,.93],outputRange:[0,y],extrapolate:'clamp'})},
              {rotate:index%2?'30deg':'0deg'},
            ],
          }]}><View style={[styles.sparkCore,{backgroundColor:index%3===0 ? colors.softGold : colors.gold,height:flare?9:burst?7:4}]}/></Animated.View>;
        })}
      </>}
      {crown && <Animated.View style={[styles.seal,{borderColor:colors.gold},motion ? {
        opacity:progress.interpolate({inputRange:[0,.38,.68,1],outputRange:[0,0,1,1]}),
        transform:[{scale:progress.interpolate({inputRange:[0,.38,.68,1],outputRange:[.55,.55,1.13,1]})}],
      } : undefined]}/>}
      <Animated.View style={motion ? {transform:[
        {translateY:progress.interpolate({inputRange:[0,peak,.67,1],outputRange:[scene.kind==='embers'?10:6,flare?-12:-6,2,0]})},
        {scale:progress.interpolate({inputRange:[0,peak,.67,1],outputRange:[.42,crown?1.47:burst?1.36:flare?1.3:1.08,.96,1]})},
      ]} : undefined}>
        <Ionicons name="flame" size={crown?50:burst?44:flare?38:33} color={colors.gold}/>
      </Animated.View>
      {crown && <Animated.View style={[styles.crownMark,motion ? {
        opacity:progress.interpolate({inputRange:[0,.57,.8,1],outputRange:[0,0,1,1]}),
        transform:[{translateY:progress.interpolate({inputRange:[.57,.8,1],outputRange:[-14,2,0],extrapolate:'clamp'})}],
      } : undefined]}><Ionicons name="sparkles" size={17} color={colors.gold}/></Animated.View>}
      </View>
    </View>
    <Animated.View style={[styles.copy, motion ? {transform:[{
      translateY:progress.interpolate({inputRange:[0,crown ? .7 : .47,1],outputRange:[layout.copyLift,0,0]}),
    }]} : undefined]} accessibilityLiveRegion="polite">
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1} style={[styles.kicker,{fontSize:9 * layout.textScale,color:colors.gold}]}>STREAK MILESTONE</Text>
      <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1} style={[styles.title,{fontSize:25 * layout.textScale,color:colors.text}]}>{tier.label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1} style={[styles.detail,{fontSize:12 * layout.textScale,color:colors.secondaryText}]}>{days} days of reading in a row</Text>
    </Animated.View>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss streak celebration" onPress={onDismiss} style={styles.dismiss}>
      <Ionicons name="close" size={19} color={colors.mutedText}/>
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  banner:{ position:"absolute", top:0, right:0, bottom:0, left:0, zIndex:1, flexDirection:'row', alignItems:'center', borderWidth:1, borderRadius:18, overflow:'hidden' },
  stage:{ alignItems:'center', justifyContent:'center' },
  glow:{ position:'absolute', borderRadius:50 },
  seal:{ position:'absolute', width:72, height:72, borderRadius:36, borderWidth:2 },
  crownMark:{ position:'absolute', top:10 },
  ring:{ position:'absolute', width:34, height:34, borderWidth:1.5, borderRadius:17 },
  spark:{ position:'absolute' },
  sparkCore:{ width:4, borderRadius:2 },
  copy:{ flex:1, minWidth:0, paddingVertical:3 },
  kicker:{ fontSize:9, fontFamily:'Inter_700Bold', letterSpacing:1 },
  title:{ fontSize:25, fontFamily:'PlayfairDisplay_700Bold', marginVertical:2 },
  detail:{ fontSize:12, fontFamily:'Inter_500Medium' },
  dismiss:{ width:44, height:44, alignSelf:'flex-start', alignItems:'center', justifyContent:'center' },
});
