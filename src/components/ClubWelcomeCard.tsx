import {Ionicons} from '@expo/vector-icons';
import {Pressable,Text,View} from 'react-native';
import {useNovoriTheme} from '../context/theme-context';
import type {ClubMemberExperience} from '../lib/club-member-experience';

export default function ClubWelcomeCard({name,experience,eventTitle,hasRules,busy,onBooks,onDiscussion,onEvents,onRules,onDismiss}:{
  name:string;experience:ClubMemberExperience;eventTitle?:string;hasRules:boolean;busy:boolean;
  onBooks:()=>void;onDiscussion:()=>void;onEvents:()=>void;onRules:()=>void;onDismiss:()=>void;
}){
  const {colors}=useNovoriTheme();
  const copy={color:colors.secondaryText,fontFamily:'Inter_400Regular',fontSize:11,lineHeight:18};
  const links=[{label:'Explore club books',icon:'book-outline' as const,note:experience.current_read_title?`Reading now · ${experience.current_read_title}`:'Find your club’s shared reads',action:onBooks},
    {label:'Join the discussion',icon:'chatbubbles-outline' as const,note:'Questions, polls, and thoughts from your club',action:onDiscussion},
    {label:'Explore club events',icon:'calendar-outline' as const,note:eventTitle?`Coming up · ${eventTitle}`:'Find your next club gathering',action:onEvents}];
  return <View style={{marginBottom:14,padding:15,borderRadius:18,borderWidth:1,borderColor:`${colors.gold}38`,backgroundColor:`${colors.gold}08`}}>
    <Text style={{...copy,color:colors.gold,fontFamily:'Inter_700Bold',fontSize:9,letterSpacing:.8}}>MAKE YOURSELF AT HOME</Text>
    <Text style={{color:colors.text,fontFamily:'PlayfairDisplay_700Bold',fontSize:21,lineHeight:27,marginTop:5}}>Welcome to {name}</Text>
    <Text style={{...copy,marginTop:6}}>Read together, share your thoughts, and get to know your club.</Text>
    <View style={{marginTop:9}}>{links.map(link=><Pressable key={link.label} accessibilityRole="button" accessibilityLabel={link.label} onPress={link.action} style={{flexDirection:'row',alignItems:'center',gap:10,minHeight:54,borderTopWidth:1,borderTopColor:`${colors.gold}18`,paddingVertical:10}}>
      <Ionicons name={link.icon} size={19} color={colors.gold}/><View style={{flex:1}}><Text style={{...copy,color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:12}}>{link.label}</Text><Text style={{...copy,color:colors.mutedText,fontSize:10}} numberOfLines={2}>{link.note}</Text></View><Ionicons name="chevron-forward" size={15} color={colors.mutedText}/>
    </Pressable>)}</View>
    {hasRules?<Pressable accessibilityRole="button" accessibilityLabel="Read welcome club rules" onPress={onRules} style={{paddingVertical:10}}><Text style={{...copy,color:colors.gold,fontFamily:'Inter_600SemiBold'}}>Read the club rules</Text></Pressable>:null}
    <View style={{flexDirection:'row',alignItems:'center',gap:10,marginTop:6}}><Text style={{...copy,color:colors.mutedText,fontSize:10,flex:1}}>You can reopen this guide from the club’s … menu.</Text><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Dismiss club welcome" onPress={onDismiss} style={{paddingHorizontal:16,paddingVertical:11,borderRadius:10,backgroundColor:colors.gold}}><Text style={{...copy,color:colors.background,fontFamily:'Inter_700Bold'}}>{busy?'Saving…':'Got it'}</Text></Pressable></View>
  </View>;
}
