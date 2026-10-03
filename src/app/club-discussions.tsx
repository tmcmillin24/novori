import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect,useLocalSearchParams,useRouter } from 'expo-router';
import { useCallback,useRef,useState } from 'react';
import { ActivityIndicator,Pressable,RefreshControl,ScrollView,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNovoriTheme } from '../context/theme-context';
import { getClub,type ClubWithMembership } from '../lib/clubs';
import { getClubRead } from '../lib/club-reads';
import { getClubDiscussions,CLUB_DISCUSSIONS_PAGE_SIZE } from '../lib/club-discussions';
import type { ClubDiscussion } from '../lib/club-discussion';
import ClubDiscussionPostAttachment from '../components/ClubDiscussionPostAttachment';
export default function ClubDiscussionsScreen(){
  const router=useRouter(),params=useLocalSearchParams<{clubId?:string;readId?:string}>(),{colors}=useNovoriTheme(),clubId=typeof params.clubId==='string'?params.clubId:'',readId=typeof params.readId==='string'?params.readId:null;
  const [club,setClub]=useState<ClubWithMembership|null>(null),[bookTitle,setBookTitle]=useState(''),[scope,setScope]=useState<'all'|'discussion'|'poll'>('all'),[rows,setRows]=useState<ClubDiscussion[]>([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[paging,setPaging]=useState(false),[more,setMore]=useState(false),[error,setError]=useState('');
  const active=useRef(true),generation=useRef(0),offset=useRef(0),pageBusy=useRef(false);
  const load=useCallback(async()=>{const version=++generation.current;setError('');try{const [group,read,topics]=await Promise.all([getClub(clubId),readId?getClubRead(readId):Promise.resolve(null),getClubDiscussions(clubId,readId,scope)]);if(active.current&&version===generation.current){setClub(group);setBookTitle(read?.book.title??'');setRows(topics);offset.current=topics.length;setMore(topics.length===CLUB_DISCUSSIONS_PAGE_SIZE);}}catch(error){if(active.current&&version===generation.current)setError((error as {message?:string})?.message||'Could not load discussions.');}finally{if(active.current&&version===generation.current){setLoading(false);setRefreshing(false);}}},[clubId,readId,scope]);
  useFocusEffect(useCallback(()=>{active.current=true;setLoading(true);void load();return()=>{active.current=false;generation.current++;};},[load]));
  async function next(){if(pageBusy.current)return;pageBusy.current=true;setPaging(true);const version=generation.current;try{const topics=await getClubDiscussions(clubId,readId,scope,offset.current);if(active.current&&version===generation.current){offset.current+=topics.length;setRows(current=>[...new Map([...current,...topics].map(topic=>[topic.id,topic])).values()]);setMore(topics.length===CLUB_DISCUSSIONS_PAGE_SIZE);}}catch(error){if(active.current)setError((error as {message?:string})?.message||'Could not load more discussions.');}finally{pageBusy.current=false;if(active.current)setPaging(false);}}
  const copy={color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:12};
  return <SafeAreaView style={{flex:1,backgroundColor:colors.background}} edges={['top','bottom']}><View style={{flexDirection:'row',alignItems:'center',gap:12,padding:16}}><Pressable accessibilityRole="button" accessibilityLabel="Back from club discussions" onPress={()=>router.back()} style={{padding:8}}><Ionicons name="chevron-back" size={25} color={colors.text}/></Pressable><Text style={{...copy,fontFamily:'PlayfairDisplay_700Bold',fontSize:22}}>Discussions & polls</Text></View>
    <ScrollView contentContainerStyle={{padding:18,paddingBottom:40,maxWidth:720,width:'100%',alignSelf:'center'}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}} tintColor={colors.gold}/>}>
      <Text style={{...copy,color:colors.mutedText,marginBottom:12}}>{bookTitle||club?.name}</Text>
      {club?.membership_role?<View style={{flexDirection:'row',gap:8,marginBottom:14}}>{(['discussion','poll'] as const).map(kind=><Pressable key={kind} accessibilityRole="button" accessibilityLabel={`Start club ${kind}`} onPress={()=>router.push({pathname:'/create-club-discussion',params:{clubId,kind,...(readId?{readId}:{})}})} style={{flex:1,minHeight:45,padding:12,borderRadius:12,backgroundColor:colors.gold}}><Text style={{...copy,color:colors.background,textAlign:'center'}}>{kind==='poll'?'Create poll':'Start discussion'}</Text></Pressable>)}</View>:null}
      <View style={{flexDirection:'row',gap:8,marginBottom:10}}>{(['all','discussion','poll'] as const).map(value=><Pressable key={value} accessibilityRole="button" accessibilityLabel={`Show club ${value}`} accessibilityState={{selected:scope===value}} onPress={()=>setScope(value)} style={{padding:10,borderRadius:10,backgroundColor:scope===value?`${colors.gold}17`:colors.surface}}><Text style={{...copy,color:scope===value?colors.gold:colors.mutedText}}>{value==='all'?'All':value==='poll'?'Polls':'Discussions'}</Text></Pressable>)}</View>
      {loading?<ActivityIndicator color={colors.gold} style={{margin:25}}/>:rows.map(row=><ClubDiscussionPostAttachment key={row.id} discussion={row}/>)}
      {!loading&&!error&&!rows.length?<Text style={{...copy,color:colors.mutedText,lineHeight:20,paddingVertical:25}}>There’s room for a good conversation. Your club’s discussions and polls will appear here.</Text>:null}
      {error?<View><Text style={{...copy,color:colors.danger,marginVertical:12}}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry club discussions" onPress={()=>void load()} style={{paddingVertical:12}}><Text style={{...copy,color:colors.gold}}>Try again</Text></Pressable></View>:null}
      {paging?<ActivityIndicator color={colors.gold} style={{margin:20}}/>:more?<Pressable accessibilityRole="button" accessibilityLabel="More club discussions" onPress={()=>void next()} style={{padding:17}}><Text style={{...copy,color:colors.gold,textAlign:'center'}}>More discussions</Text></Pressable>:null}
    </ScrollView>
  </SafeAreaView>;
}
