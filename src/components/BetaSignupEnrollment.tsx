import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';

export default function BetaSignupEnrollment({phase,optIn,onChange,disabled}: {
 phase: 'automatic'|'optional'|'closed'; optIn:boolean; onChange:(value:boolean)=>void; disabled:boolean;
}) {
 const {colors}=useNovoriTheme();
 if(phase==='closed') return null;
 const copy={color:colors.secondaryText,fontFamily:'Inter_400Regular',fontSize:13,lineHeight:20};
 return <View style={{marginVertical:12,padding:16,borderRadius:14,borderWidth:1,borderColor:colors.gold}}>
  <Text style={{...copy,color:colors.gold,fontFamily:'Inter_600SemiBold',marginBottom:8}}>Welcome to Novori’s beta</Text>
  <Text style={copy}>The first 15 new accounts join Novori Beta Testers automatically. For the next 35 accounts, enrollment is optional. Enrolled testers follow Novori’s creator and mutually follow other enrolled testers. You can unfollow anyone or leave the club at any time.</Text>
  {phase==='automatic' ? <Text style={{...copy,marginTop:8,fontFamily:'Inter_600SemiBold'}}>Your account will enroll automatically if it is among the first 15.</Text> : null}
  <Pressable accessibilityRole="checkbox" accessibilityLabel="Join beta testing when enrollment is optional" accessibilityState={{checked:optIn,disabled}} disabled={disabled} onPress={()=>onChange(!optIn)} style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:48,marginTop:4}}>
   <Ionicons name={optIn?'checkbox':'square-outline'} size={22} color={colors.gold}/>
   <Text style={{...copy,flex:1}}>Join beta testing if enrollment is optional when my account is created.</Text>
  </Pressable>
 </View>;
}
