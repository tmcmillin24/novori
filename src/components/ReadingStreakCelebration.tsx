import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { readingStreakTier, reachedReadingStreakTier, STREAK_TIERS, type StreakTier } from '../lib/reading-streak-tier';

type Milestone = {tier: StreakTier; days: number};

export default function ReadingStreakCelebration({ tier, days, onDismiss }: Milestone & {onDismiss: () => void}) {
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
    const animation = Animated.timing(progress, {toValue:1, duration:1150, easing:Easing.out(Easing.cubic), useNativeDriver:true});
    animation.start();
    return () => animation.stop();
  }, [motion, progress]);

  return <View style={[styles.banner,{borderColor:tier.color}]}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stage}>
      {motion && <>
        <Animated.View style={[styles.ring,{borderColor:tier.color,
          opacity:progress.interpolate({inputRange:[0,.3,1],outputRange:[.85,.7,0]}),
          transform:[{scale:progress.interpolate({inputRange:[0,1],outputRange:[.48,2.35]})}],
        }]}/>
        {Array.from({length:tier.sparks}, (_, index) => {
          const angle = index / tier.sparks * Math.PI * 2;
          const distance = 29 + (index % 3) * 5;
          return <Animated.View key={index} style={[styles.spark,{backgroundColor:tier.color,
            opacity:progress.interpolate({inputRange:[0,.17,.67,1],outputRange:[0,1,.85,0]}),
            transform:[
              {translateX:Animated.multiply(progress,Math.cos(angle)*distance)},
              {translateY:Animated.multiply(progress,Math.sin(angle)*distance)},
            ],
          }]}/>;
        })}
      </>}
      <Animated.View style={motion ? {transform:[{scale:progress.interpolate({inputRange:[0,.26,.58,1],outputRange:[.72,1.32,.94,1]})}]} : undefined}>
        <Ionicons name="flame" size={37} color={tier.color}/>
      </Animated.View>
    </View>
    <View style={styles.copy} accessibilityLiveRegion="polite">
      <Text style={[styles.kicker,{color:tier.color}]}>STREAK MILESTONE</Text>
      <Text accessibilityRole="header" style={styles.title}>{tier.label}</Text>
      <Text style={styles.detail}>{days} days of reading in a row</Text>
    </View>
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
  stage:{ width:68, height:76, alignItems:'center', justifyContent:'center' },
  ring:{ position:'absolute', width:34, height:34, borderWidth:1.5, borderRadius:17 },
  spark:{ position:'absolute', width:4, height:4, borderRadius:2 },
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
