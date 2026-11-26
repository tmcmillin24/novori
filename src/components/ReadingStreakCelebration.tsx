import { useNovoriTheme } from '../context/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { readingStreakTier, reachedReadingStreakTier, STREAK_TIERS, type StreakTier } from '../lib/reading-streak-tier';

const scenes = {
  3:  { kind:'embers', duration:1050, stage:84, glow:44 },
  7:  { kind:'flare', duration:1350, stage:92, glow:54 },
  14: { kind:'burst', duration:1700, stage:108, glow:65 },
  30: { kind:'crown', duration:2100, stage:122, glow:76 },
} as const;

type Milestone = {tier: StreakTier; days: number};

export default function ReadingStreakCelebration({ tier, days, onDismiss }: Milestone & {onDismiss: () => void}) {
  const { colors } = useNovoriTheme();
  const scene = scenes[tier.days];
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
      Animated.timing(opacity, {toValue:0, duration:380, useNativeDriver:true, isInteraction:false}),
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
      style={[styles.stage,{width:scene.stage,height:88}]}>
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
    <Animated.View style={[styles.copy, motion ? {transform:[{
      translateY:progress.interpolate({inputRange:[0,crown ? .7 : .47,1],outputRange:[7,0,0]}),
    }]} : undefined]} accessibilityLiveRegion="polite">
      <Text style={[styles.kicker,{color:colors.gold}]}>STREAK MILESTONE</Text>
      <Text accessibilityRole="header" style={[styles.title,{color:colors.text}]}>{tier.label}</Text>
      <Text style={[styles.detail,{color:colors.secondaryText}]}>{days} days of reading in a row</Text>
    </Animated.View>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss streak celebration" hitSlop={8} onPress={onDismiss} style={styles.dismiss}>
      <Ionicons name="close" size={19} color={colors.mutedText}/>
    </Pressable>
  </Animated.View>;
}

export function ReadingStreakPreview() {
  const { colors } = useNovoriTheme();
  const [days, setDays] = useState(2);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const tier = readingStreakTier(days);
  const choose = (value: number) => { setDays(value); setMilestone(null); };
  const simulate = () => {
    const hit = reachedReadingStreakTier(days, days+1);
    setDays(days+1);
    setMilestone(hit ? {tier:hit,days:days+1} : null);
  };
  return <View style={[styles.preview,{backgroundColor:colors.surface,borderColor:colors.border}]}>
    <Text style={[styles.previewText,{color:colors.text}]}>Streak preview · {days} days{tier ? ' · '+tier.label : ''}</Text>
    <View style={styles.previewRow}>
      {[...STREAK_TIERS.map(tier => tier.days-1),30].map(value =>
        <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Set preview streak to ${value} days`}
          accessibilityState={{selected:days===value}} onPress={() => choose(value)} style={[styles.previewButton,{backgroundColor:colors.elevated,borderColor:colors.border}]}>
          <Text style={[styles.previewText,{color:colors.text}]}>{value}d</Text>
        </Pressable>)}
    </View>
    <Pressable accessibilityRole="button" onPress={simulate} style={[styles.previewButton,{backgroundColor:colors.elevated,borderColor:colors.border}]}>
      <Text style={[styles.previewText,{color:colors.text}]}>Simulate check-in</Text>
    </Pressable>
    <View>
      <View accessibilityElementsHidden={Boolean(milestone)} importantForAccessibility={milestone ? 'no-hide-descendants' : 'auto'}>
        <Text style={[styles.previewCheckin,{backgroundColor:colors.gold,color:colors.background}]}>✓ Checked in</Text>
        <View style={styles.previewDays}>
          {['M','T','W','T','F','S','S'].map((day,index) =>
            <Text key={index} style={[styles.previewDay,{backgroundColor:index<4 ? colors.gold : colors.elevated,color:index<4 ? colors.background : colors.text}]}>{day}</Text>)}
        </View>
      </View>
      {milestone && <ReadingStreakCelebration key={milestone.days} {...milestone} onDismiss={() => setMilestone(null)}/>}
    </View>
  </View>;
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
  copy:{ flex:1, paddingVertical:3 },
  kicker:{ fontSize:9, fontFamily:'Inter_700Bold', letterSpacing:1 },
  title:{ fontSize:25, fontFamily:'PlayfairDisplay_700Bold', marginVertical:2 },
  detail:{ fontSize:12, fontFamily:'Inter_500Medium' },
  dismiss:{ minWidth:36, alignSelf:'flex-start', alignItems:'center', paddingVertical:5 },
  preview:{ borderWidth:1, borderRadius:14, padding:10, marginTop:10, gap:8 },
  previewCheckin:{ textAlign:'center', padding:12, borderRadius:12 },
  previewDays:{ flexDirection:'row', justifyContent:'space-between', paddingVertical:14 },
  previewDay:{ width:25,height:25,borderRadius:13,textAlign:'center',textAlignVertical:'center',lineHeight:25 },
  previewRow:{ flexDirection:'row', flexWrap:'wrap', gap:6 },
  previewButton:{ borderWidth:1, padding:8, borderRadius:8 },
  previewText:{ fontSize:12, fontFamily:'Inter_600SemiBold' },
});
