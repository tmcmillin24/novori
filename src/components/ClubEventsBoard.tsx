import { Ionicons } from '@expo/vector-icons';
import { useEffect,useRef,useState } from 'react';
import { ActivityIndicator,Pressable,Text,View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNovoriTheme } from '../context/theme-context';
import { getClubEvents,CLUB_EVENTS_PAGE_SIZE } from '../lib/club-events';
import { isUpcomingClubEvent,type ClubEvent } from '../lib/club-event';
import ClubEventCard from './ClubEventCard';

export default function ClubEventsBoard({clubId,upcoming,canManage,now,showCreateAction=true}:{clubId:string;upcoming:ClubEvent[];canManage:boolean;now:number;showCreateAction?:boolean}) {
  const router=useRouter(),{colors}=useNovoriTheme();const [scope,setScope]=useState<'upcoming'|'past'>('upcoming');
  const [future,setFuture]=useState(upcoming),[past,setPast]=useState<ClubEvent[]>([]),[pastLoaded,setPastLoaded]=useState(false);
  const [offsets,setOffsets]=useState({upcoming:upcoming.length,past:0}),[hasMore,setHasMore]=useState({upcoming:upcoming.length===CLUB_EVENTS_PAGE_SIZE,past:true});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const loadBusy=useRef(false),active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{setFuture(upcoming);setPast([]);setPastLoaded(false);setOffsets({upcoming:upcoming.length,past:0});setHasMore({upcoming:upcoming.length===CLUB_EVENTS_PAGE_SIZE,past:true});},[upcoming]);
  async function load(which:'upcoming'|'past',first=false){
    if(loadBusy.current)return;loadBusy.current=true;setBusy(true);setError('');
    try {const offset=first?0:offsets[which],page=await getClubEvents(clubId,which,offset);if(!active.current)return;
      const add=(existing:ClubEvent[])=>[...new Map([...(first?[]:existing),...page].map(event=>[event.id,event])).values()];
      if(which==='past'){setPast(add);setPastLoaded(true);}else setFuture(add);
      setOffsets(current=>({...current,[which]:offset+page.length}));setHasMore(current=>({...current,[which]:page.length===CLUB_EVENTS_PAGE_SIZE}));
    }catch(error){if(active.current)setError((error as {message?:string})?.message||'Could not load events.');}finally{loadBusy.current=false;if(active.current)setBusy(false);}
  }
  useEffect(()=>{if(scope==='past'&&!pastLoaded&&!loadBusy.current)void load('past',true);},[scope,pastLoaded,upcoming]);
  const events=scope==='upcoming'?future.filter(event=>isUpcomingClubEvent(event,now)):[...new Map([...past,...future.filter(event=>!isUpcomingClubEvent(event,now))].map(event=>[event.id,event])).values()].sort((a,b)=>Date.parse(b.starts_at)-Date.parse(a.starts_at));
  return <View>
    {canManage&&showCreateAction?<Pressable accessibilityRole="button" accessibilityLabel="Create club event" onPress={()=>router.push({pathname:'/create-club-event',params:{clubId}})} style={{backgroundColor:colors.gold,borderRadius:13,minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginBottom:13}}><Ionicons name="add" size={18} color={colors.background}/><Text style={{color:colors.background,fontFamily:'Inter_700Bold',fontSize:12}}>Create an event</Text></Pressable>:null}
    <View style={{flexDirection:'row',gap:10,marginBottom:13}}>{(['upcoming','past'] as const).map(option=><Pressable key={option} disabled={busy} accessibilityRole="button" accessibilityLabel={option==='upcoming'?'Upcoming club events':'Past club events'} accessibilityState={{selected:scope===option}} onPress={()=>{setScope(option);setError('');if(option==='past'&&!pastLoaded)void load('past',true);}} style={{paddingHorizontal:13,paddingVertical:9,borderRadius:10,backgroundColor:scope===option?`${colors.gold}18`:colors.surface}}><Text style={{color:scope===option?colors.gold:colors.mutedText,fontFamily:'Inter_600SemiBold',fontSize:12}}>{option==='upcoming'?'Upcoming':'Past & cancelled'}</Text></Pressable>)}</View>
    {events.map(event=><ClubEventCard key={event.id} event={event} now={now} onOpen={()=>router.push({pathname:'/club-event/[id]',params:{id:event.id}})}/>)}
    {!busy&&!events.length&&!error?<View style={{padding:24,alignItems:'center',borderWidth:1,borderColor:colors.border,borderRadius:18,backgroundColor:colors.surface}}><Ionicons name="calendar-outline" size={28} color={colors.gold}/><Text style={{color:colors.text,fontFamily:'PlayfairDisplay_600SemiBold',fontSize:19,marginTop:9}}>{scope==='upcoming'?'Make time to read together':'Your club’s event history'}</Text><Text style={{color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:12,textAlign:'center',marginTop:8,lineHeight:18}}>{scope==='upcoming'?'Upcoming meetups and conversations will appear here.':'Past and cancelled events stay here for your club to revisit.'}</Text></View>:null}
    {error?<Text style={{color:colors.danger,fontFamily:'Inter_400Regular',fontSize:12,marginVertical:10}}>{error}</Text>:null}
    {busy?<ActivityIndicator color={colors.gold} style={{margin:15}}/>:hasMore[scope]||error?<Pressable accessibilityRole="button" accessibilityLabel="Load more club events" onPress={()=>void load(scope,scope==='past'&&!pastLoaded)} style={{padding:14,alignItems:'center'}}><Text style={{color:colors.gold,fontFamily:'Inter_600SemiBold',fontSize:12}}>{error?'Try again':'More events'}</Text></Pressable>:null}
  </View>;
}
