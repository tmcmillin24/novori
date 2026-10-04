import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect,useLocalSearchParams,useRouter } from 'expo-router';
import { useCallback,useMemo,useRef,useState } from 'react';
import { ActivityIndicator,Linking,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ClubEventCard from '../../components/ClubEventCard';
import ClubEventActionsSheet from '../../components/ClubEventActionsSheet';
import ClubPinActionsSheet from '../../components/ClubPinActionsSheet';
import DeletePostConfirmSheet from '../../components/DeletePostConfirmSheet';
import ValidationWarningSheet from '../../components/ValidationWarningSheet';
import useEventClock from '../../hooks/use-event-clock';
import { useNovoriTheme } from '../../context/theme-context';
import { getClub,type ClubWithMembership } from '../../lib/clubs';
import { canManageClubPosts,getClubPins,resolveClubPinnedPosts,setClubPostPin } from '../../lib/club-posts';
import { getPostDetail,type FeedPost } from '../../lib/feed';
import { getClubEvent,cancelClubEvent,setClubEventRsvp } from '../../lib/club-events';
import { shareClubEventLink } from '../../lib/share-links';
import { isUpcomingClubEvent,type ClubEvent,type ClubEventRsvp } from '../../lib/club-event';

export default function ClubEventScreen() {
  const router=useRouter(),params=useLocalSearchParams<{id?:string}>(),{colors}=useNovoriTheme();const eventId=typeof params.id==='string'?params.id:'';
  const styles=useMemo(()=>StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:17,paddingVertical:10},button:{padding:8,width:42},title:{color:colors.text,fontFamily:'PlayfairDisplay_700Bold',fontSize:20},content:{padding:18,paddingBottom:40,maxWidth:720,width:'100%',alignSelf:'center'},club:{color:colors.gold,fontFamily:'Inter_600SemiBold',fontSize:12,marginBottom:14},section:{color:colors.text,fontFamily:'Inter_700Bold',fontSize:13,marginTop:9,marginBottom:10},row:{flexDirection:'row',gap:7},rsvp:{flex:1,minHeight:46,borderRadius:11,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},rsvpText:{color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:11},note:{color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:12,lineHeight:19,marginTop:12},link:{minHeight:46,flexDirection:'row',alignItems:'center',gap:8,marginTop:14},linkText:{color:colors.gold,fontFamily:'Inter_600SemiBold',fontSize:12},center:{padding:30,alignItems:'center'}}),[colors]);
  const [event,setEvent]=useState<ClubEvent|null>(null),[club,setClub]=useState<ClubWithMembership|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState(false),[warning,setWarning]=useState(''),[options,setOptions]=useState(false),[cancelConfirm,setCancelConfirm]=useState(false),[pinTarget,setPinTarget]=useState<FeedPost|null>(null),[pins,setPins]=useState<FeedPost[]>([]);
  const mutationBusy=useRef(false),active=useRef(true);const now=useEventClock(event?Date.parse(event.ends_at):undefined);
  useFocusEffect(useCallback(()=>{active.current=true;let current=true;(async()=>{
    try {setLoading(true);setError('');const data=await getClubEvent(eventId),group=await getClub(data.club_id);if(current){setEvent(data);setClub(group);}}
    catch(error){if(current)setError((error as {message?:string})?.message||'Could not load the event.');}finally{if(current)setLoading(false);}
  })();return()=>{current=false;active.current=false;};},[eventId]));
  const manager=canManageClubPosts(club?.membership_role),member=Boolean(club?.membership_role),upcoming=Boolean(event&&isUpcomingClubEvent(event,now));
  async function refresh(){if(!event||refreshing)return;try{setRefreshing(true);const data=await getClubEvent(event.id);setEvent(data);}catch(error){setWarning((error as {message?:string})?.message||'Could not refresh the event.');}finally{setRefreshing(false);}}
  async function respond(status:ClubEventRsvp){if(!event||!member||!upcoming||mutationBusy.current)return;
    try{mutationBusy.current=true;setBusy(true);const data=await setClubEventRsvp(event.id,event.viewer_rsvp===status?null:status);if(active.current)setEvent(data);}
    catch(error){if(active.current)setWarning((error as {message?:string})?.message||'Could not save your RSVP.');}finally{mutationBusy.current=false;if(active.current)setBusy(false);}}
  async function cancel(){if(!event||!manager||mutationBusy.current)return;
    try{mutationBusy.current=true;setBusy(true);await cancelClubEvent(event.id);const data=await getClubEvent(event.id);if(active.current){setEvent(data);setCancelConfirm(false);}}
    catch(error){if(active.current){setCancelConfirm(false);setWarning((error as {message?:string})?.message||'Could not cancel the event.');}}finally{mutationBusy.current=false;if(active.current)setBusy(false);}}
  async function showPins(){if(!event||!manager||mutationBusy.current)return;
    try{mutationBusy.current=true;setBusy(true);const [rows,post]=await Promise.all([getClubPins(event.club_id),getPostDetail(event.post_id)]);const pinned=await resolveClubPinnedPosts(event.club_id,rows,[post]);if(active.current){setPins(pinned);setPinTarget(post);}}
    catch(error){if(active.current)setWarning((error as {message?:string})?.message||'Could not load pins.');}finally{mutationBusy.current=false;if(active.current)setBusy(false);}}
  async function pin(postId:string,pinned:boolean,replacePostId?:string){if(!event||!manager||mutationBusy.current)return;
    try{mutationBusy.current=true;setBusy(true);await setClubPostPin(event.club_id,postId,pinned,replacePostId);}catch(error){if(active.current)setWarning((error as {message?:string})?.message||'Could not update pins.');}finally{mutationBusy.current=false;if(active.current)setBusy(false);}}
  async function shareEvent(){if(!event)return;try{await shareClubEventLink({eventId:event.id,title:event.title});}catch{setWarning('Could not share the event. Please try again.');}}
  async function joinMeeting(){if(!event?.meeting_url)return;try{const link=new URL(event.meeting_url);if(!['http:','https:'].includes(link.protocol))throw Error('Invalid meeting link.');await Linking.openURL(event.meeting_url);}catch{setWarning('Could not open the meeting link.');}}
  return <SafeAreaView style={styles.safe} edges={['top','bottom']}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back from event" onPress={()=>router.back()} style={styles.button}><Ionicons name="chevron-back" size={25} color={colors.text}/></Pressable><Text style={styles.title}>Club event</Text>
      <View style={styles.row}>{event&&!loading&&!error?<Pressable accessibilityRole="button" accessibilityLabel="Share club event" onPress={()=>void shareEvent()} style={styles.button}><Ionicons name="share-social-outline" size={23} color={colors.text}/></Pressable>:null}
      {manager&&upcoming?<Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Open event options" onPress={()=>setOptions(true)} style={styles.button}><Ionicons name="ellipsis-horizontal" size={23} color={colors.text}/></Pressable>:<View style={styles.button}/>}</View></View>
    {loading?<View style={styles.center}><ActivityIndicator color={colors.gold}/></View>:error||!event?<View style={styles.center}><Text style={styles.note}>{error||'This event is unavailable.'}</Text></View>:<ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh()} tintColor={colors.gold}/>}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open event club" onPress={()=>router.push({pathname:'/club/[id]',params:{id:event.club_id,tab:'events'}})}><Text style={styles.club}>in {club?.name}</Text></Pressable>
      <ClubEventCard event={event} detail now={now}/>
      <Text style={styles.section}>{upcoming?'Will you be there?':'Event responses'}</Text>
      <Text style={styles.note}>{event.going_count??0} going · {event.maybe_count??0} maybe</Text>
      {member?<View style={[styles.row,{marginTop:12}]}>{([['going','Going'],['maybe','Maybe'],['cant_go','Can’t go']] as const).map(([status,label])=><Pressable key={status} accessibilityRole="button" accessibilityLabel={`RSVP ${label}`} accessibilityState={{selected:event.viewer_rsvp===status}} disabled={busy||!upcoming} onPress={()=>void respond(status)} style={[styles.rsvp,event.viewer_rsvp===status&&{borderColor:colors.gold,backgroundColor:`${colors.gold}15`},(!upcoming||busy)&&{opacity:.55}]}><Text style={styles.rsvpText}>{label}</Text></Pressable>)}</View>:<Text style={styles.note}>Join this club to RSVP.</Text>}
      {!upcoming?<Text style={styles.note}>{event.cancelled_at?'This event was cancelled.':'This event has ended.'} RSVPs are closed.</Text>:null}
      {upcoming&&event.kind==='virtual'?<Pressable accessibilityRole="button" accessibilityLabel="Open meeting link" onPress={()=>void joinMeeting()} style={styles.link}><Ionicons name="videocam-outline" size={18} color={colors.gold}/><Text style={styles.linkText}>Open meeting link</Text></Pressable>:null}
      {event.book?<Pressable accessibilityRole="button" accessibilityLabel="View event book" onPress={()=>router.push({pathname:'/book/[id]',params:{id:event.book!.googleBookId}})} style={styles.link}><Ionicons name="book-outline" size={18} color={colors.gold}/><Text style={styles.linkText}>View book</Text></Pressable>:null}
      <Pressable accessibilityRole="button" accessibilityLabel="View event discussion" onPress={()=>router.push({pathname:'/post/[id]',params:{id:event.post_id}})} style={styles.link}><Ionicons name="chatbubbles-outline" size={18} color={colors.gold}/><Text style={styles.linkText}>View discussion</Text></Pressable>
    </ScrollView>}
    <ClubEventActionsSheet visible={options} eventTitle={event?.title??'Event'} onDismiss={()=>setOptions(false)} onAction={action=>{if(!event||!manager||!upcoming)return;if(action==='edit')router.push({pathname:'/create-club-event',params:{clubId:event.club_id,eventId:event.id}});else if(action==='cancel')setCancelConfirm(true);else void showPins();}}/>
    <ClubPinActionsSheet visible={Boolean(pinTarget)} post={pinTarget} pinnedPosts={pins} busy={busy} onDismiss={()=>setPinTarget(null)} onPin={(postId,pinned,replaceId)=>void pin(postId,pinned,replaceId)}/>
    <DeletePostConfirmSheet visible={cancelConfirm} busy={busy} title="Cancel this event?" message="Your club will still see the cancelled event in its history. RSVPs will close and its pin will be removed." confirmLabel="Cancel event" cancelLabel="Keep event" onConfirm={cancel} onDismiss={()=>{if(!busy)setCancelConfirm(false);}}/>
    <ValidationWarningSheet visible={Boolean(warning)} title="Club event" message={warning} onDismiss={()=>setWarning('')}/>
  </SafeAreaView>;
}
