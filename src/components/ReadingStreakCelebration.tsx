import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { readingStreakTier, reachedReadingStreakTier, STREAK_TIERS, type StreakTier } from '../lib/reading-streak-tier';

const scenes = {
  3:  { kind:'embers', duration:1050, height:100, stage:84, glow:44 },
  7:  { kind:'flare', duration:1350, height:114, stage:92, glow:54 },
  14: { kind:'burst', duration:1700, height:132, stage:108, glow:65 },
  30: { kind:'crown', duration:2100, height:152, stage:122, glow:76 },
} as const;

type Milestone = {tier: StreakTier; days: number};

export default function ReadingStreakCelebration({ tier, days, onDismiss }: Milestone & {onDismiss: () => void}) {
  const scene = scenes[tier.days];
  const progress = useRef(new Animated.Value(0)).current;
  const [motion, setMotion] = useState(false);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', reduced => {
      changed = true;
      setMotion(!reduced);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (active && !changed) setMotion(!reduced);
    }, () => {});
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!motion) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {toValue:1, duration:scene.duration, easing:Easing.linear, useNativeDriver:true});
    animation.start();
    return () => animation.stop();
  }, [motion, progress, scene.duration]);

  const crown = scene.kind === 'crown';
  const ringCount = scene.kind === 'embers' ? 0 : scene.kind === 'flare' ? 1 : 2;
  const flare = scene.kind === 'flare';
  const burst = scene.kind === 'burst';
  const peak = crown ? .37 : flare ? .23 : .31;
  return <View style={[styles.banner,{borderColor:tier.color,minHeight:scene.height}]}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.stage,{width:scene.stage,height:scene.height-14}]}>
      <View style={[styles.glow,{width:scene.glow,height:scene.glow,backgroundColor:tier.color,opacity:crown ? .16 : .10}]}/>
      {motion && <>
        {Array.from({length:ringCount}, (_, index) => {
          const start = (crown ? .22 : .11) + index*.15;
          return <Animated.View key={index} style={[styles.ring,{borderColor:tier.color,
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
          }]}><View style={[styles.sparkCore,{backgroundColor:index%3===0?'#FFF5DE':tier.color,height:flare?9:burst?7:4}]}/></Animated.View>;
        })}
      </>}
      {crown && <Animated.View style={[styles.seal,{borderColor:tier.color},motion ? {
        opacity:progress.interpolate({inputRange:[0,.38,.68,1],outputRange:[0,0,1,1]}),
        transform:[{scale:progress.interpolate({inputRange:[0,.38,.68,1],outputRange:[.55,.55,1.13,1]})}],
      } : undefined]}/>}
      <Animated.View style={motion ? {transform:[
        {translateY:progress.interpolate({inputRange:[0,peak,.67,1],outputRange:[scene.kind==='embers'?10:6,flare?-12:-6,2,0]})},
        {scale:progress.interpolate({inputRange:[0,peak,.67,1],outputRange:[.42,crown?1.47:burst?1.36:flare?1.3:1.08,.96,1]})},
      ]} : undefined}>
        <Ionicons name="flame" size={crown?50:burst?44:flare?38:33} color={tier.color}/>
      </Animated.View>
      {crown && <Animated.View style={[styles.crownMark,motion ? {
        opacity:progress.interpolate({inputRange:[0,.57,.8,1],outputRange:[0,0,1,1]}),
        transform:[{translateY:progress.interpolate({inputRange:[.57,.8,1],outputRange:[-14,2,0],extrapolate:'clamp'})}],
      } : undefined]}><Ionicons name="sparkles" size={17} color={tier.color}/></Animated.View>}
    </View>
    <Animated.View style={[styles.copy, motion ? {transform:[{
      translateY:progress.interpolate({inputRange:[0,crown ? .7 : .47,1],outputRange:[7,0,0]}),
    }]} : undefined]} accessibilityLiveRegion="polite">
      <Text style={[styles.kicker,{color:tier.color}]}>STREAK MILESTONE</Text>
      <Text accessibilityRole="header" style={styles.title}>{tier.label}</Text>
      <Text style={styles.detail}>{days} days of reading in a row</Text>
    </Animated.View>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss streak celebration" hitSlop={8} onPress={onDismiss} style={styles.dismiss}>
      <Ionicons name="close" size={19} color="#E5CBB4"/>
    </Pressable>
  </View>;
}

export function ReadingStreakPreview() {
  const [days, setDays] = useState(2);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const tier = readingStreakTier(days);
  const choose = (value: number) => { setDays(value); setMilestone(null); };
  const simulate = () => {
    const hit = reachedReadingStreakTier(days, days+1);
    setDays(days+1);
    setMilestone(hit ? {tier:hit,days:days+1} : null);
  };
  return <View style={styles.preview}>
    <Text style={styles.previewText}>Streak preview · {days} days{tier ? ' · '+tier.label : ''}</Text>
    <View style={styles.previewRow}>
      {[...STREAK_TIERS.map(tier => tier.days-1),30].map(value =>
        <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Set preview streak to ${value} days`}
          accessibilityState={{selected:days===value}} onPress={() => choose(value)} style={styles.previewButton}>
          <Text style={styles.previewText}>{value}d</Text>
        </Pressable>)}
    </View>
    <Pressable accessibilityRole="button" onPress={simulate} style={styles.previewButton}>
      <Text style={styles.previewText}>Simulate check-in</Text>
    </Pressable>
    {milestone && <ReadingStreakCelebration key={milestone.days} {...milestone} onDismiss={() => setMilestone(null)}/>}
  </View>;
}

const styles = StyleSheet.create({
  banner:{ flexDirection:'row', alignItems:'center', backgroundColor:'#302019', borderWidth:1, borderRadius:18, minHeight:96, marginTop:12, paddingVertical:9 },
  stage:{ alignItems:'center', justifyContent:'center' },
  glow:{ position:'absolute', borderRadius:50 },
  seal:{ position:'absolute', width:72, height:72, borderRadius:36, borderWidth:2 },
  crownMark:{ position:'absolute', top:10 },
  ring:{ position:'absolute', width:34, height:34, borderWidth:1.5, borderRadius:17 },
  spark:{ position:'absolute' },
  sparkCore:{ width:4, borderRadius:2 },
  copy:{ flex:1, paddingVertical:3 },
  kicker:{ fontSize:9, fontFamily:'Inter_700Bold', letterSpacing:1 },
  title:{ fontSize:25, color:'#FFF5E9', fontFamily:'PlayfairDisplay_700Bold', marginVertical:2 },
  detail:{ fontSize:12, color:'#F1DACC', fontFamily:'Inter_500Medium' },
  dismiss:{ minWidth:36, alignSelf:'flex-start', alignItems:'center', paddingVertical:5 },
  preview:{ backgroundColor:'#211915', borderRadius:14, padding:10, marginTop:10, gap:8 },
  previewRow:{ flexDirection:'row', flexWrap:'wrap', gap:6 },
  previewButton:{ padding:8, backgroundColor:'#533A2B', borderRadius:8 },
  previewText:{ color:'#FFF5E9', fontSize:12, fontFamily:'Inter_600SemiBold' },
});
