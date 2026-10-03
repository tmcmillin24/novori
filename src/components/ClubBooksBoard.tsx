import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect,useRouter } from 'expo-router';
import { useCallback,useRef,useState } from 'react';
import { ActivityIndicator,Pressable,ScrollView,Text,View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { getClubReads,saveClubRead,removeClubRead } from '../lib/club-reads';
import type { ClubRead,ClubReads,ClubReadStatus } from '../lib/club-read';
import ClubReadCard from './ClubReadCard';
import ClubReadActionsSheet,{type ClubReadAction} from './ClubReadActionsSheet';
import DeletePostConfirmSheet from './DeletePostConfirmSheet';
import ValidationWarningSheet from './ValidationWarningSheet';
const EMPTY:ClubReads={current:null,upcoming:[],past:[],upcoming_more:false,past_more:false};
export default function ClubBooksBoard({clubId,canManage,refreshVersion=0,showAddAction=true}:{clubId:string;canManage:boolean;refreshVersion?:number;showAddAction?:boolean}) {
  const router=useRouter(),{colors}=useNovoriTheme();const [reads,setReads]=useState<ClubReads>(EMPTY),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[warning,setWarning]=useState('');
  const [target,setTarget]=useState<ClubRead|null>(null),[removing,setRemoving]=useState<ClubRead|null>(null);
  const active=useRef(true),sequence=useRef(0),mutationBusy=useRef(false),pageBusy=useRef(false),offsets=useRef({upcoming:0,past:0});
  const load=useCallback(async()=>{const version=++sequence.current;setLoading(true);setError('');try{
    const data=await getClubReads(clubId);if(active.current&&version===sequence.current){setReads(data);offsets.current={upcoming:data.upcoming.length,past:data.past.length};}
  }catch(error){if(active.current&&version===sequence.current)setError((error as {message?:string})?.message||'Could not load the club’s books.');}finally{if(active.current&&version===sequence.current)setLoading(false);}},[clubId]);
  useFocusEffect(useCallback(()=>{active.current=true;void load();return()=>{active.current=false;sequence.current++;};},[load,refreshVersion]));
  async function more(scope:'upcoming'|'past'){if(pageBusy.current||mutationBusy.current)return;const version=sequence.current;pageBusy.current=true;setBusy(true);
    try{const data=await getClubReads(clubId,scope,offsets.current[scope]);if(active.current&&version===sequence.current){offsets.current[scope]+=data[scope].length;setReads(current=>({...current,[scope]:[...new Map([...current[scope],...data[scope]].map(read=>[read.id,read])).values()],[`${scope}_more`]:data[`${scope}_more`]}));}}
    catch(error){if(active.current)setWarning((error as {message?:string})?.message||'Could not load more books.');}finally{pageBusy.current=false;if(active.current)setBusy(false);}}
  async function change(read:ClubRead,status:ClubReadStatus){if(!canManage||mutationBusy.current)return;mutationBusy.current=true;setBusy(true);
    try{await saveClubRead(clubId,{book:read.book,status,started_on:read.started_on,ended_on:read.ended_on,note:read.note},read);if(active.current)await load();}
    catch(error){if(active.current)setWarning((error as {message?:string})?.message||'Could not update the club read.');}finally{mutationBusy.current=false;if(active.current)setBusy(false);}}
  async function remove(){if(!removing||!canManage||mutationBusy.current)return;mutationBusy.current=true;setBusy(true);
    try{await removeClubRead(removing);if(active.current){setRemoving(null);await load();}}
    catch(error){if(active.current){setRemoving(null);setWarning((error as {message?:string})?.message||'Could not remove the club read.');}}finally{mutationBusy.current=false;if(active.current)setBusy(false);}}
  function action(read:ClubRead,value:ClubReadAction){if(!canManage||busy)return;if(value==='edit')router.push({pathname:'/edit-club-read',params:{clubId,readId:read.id}});else if(value==='remove')setRemoving(read);else void change(read,value);}
  const add=(status:ClubReadStatus='upcoming')=>router.push({pathname:'/edit-club-read',params:{clubId,status}});
  const card=(read:ClubRead)=><ClubReadCard key={read.id} read={read} onOpen={()=>router.push({pathname:'/book/[id]',params:{id:read.book.googleBookId}})} onOptions={canManage&&!busy?()=>setTarget(read):undefined}/>;
  const heading={color:colors.text,fontFamily:'PlayfairDisplay_700Bold',fontSize:22};const note={color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:12,lineHeight:19};
  return <View>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14}}><Text style={heading}>Your club’s bookshelf</Text>{canManage&&showAddAction?<Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Add club read" onPress={()=>add()} style={{flexDirection:'row',gap:5,alignItems:'center',padding:9,borderRadius:10,backgroundColor:`${colors.gold}15`}}><Ionicons name="add" size={17} color={colors.gold}/><Text style={{color:colors.gold,fontFamily:'Inter_600SemiBold',fontSize:11}}>Add book</Text></Pressable>:null}</View>
    {loading?<ActivityIndicator color={colors.gold} style={{margin:25}}/>:error?<View><Text style={note}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry club books" onPress={()=>void load()} style={{paddingVertical:15}}><Text style={{...note,color:colors.gold}}>Try again</Text></Pressable></View>:<>
      {reads.current?card(reads.current):<View style={{padding:21,borderRadius:18,backgroundColor:colors.surface,borderWidth:1,borderColor:`${colors.gold}40`,alignItems:'center'}}><Ionicons name="book-outline" size={29} color={colors.gold}/><Text style={{...heading,fontSize:20,marginTop:10}}>What are we reading together?</Text><Text style={{...note,textAlign:'center',marginTop:7}}>Your current club read will live here.</Text>{canManage?<Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Choose current club read" onPress={()=>add('current')} style={{padding:12,marginTop:8}}><Text style={{...note,color:colors.gold,fontFamily:'Inter_600SemiBold'}}>Choose a current read</Text></Pressable>:null}</View>}
      {(['upcoming','past'] as const).map(scope=><View key={scope} style={{marginTop:24}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12}}><Text style={{...heading,fontSize:20}}>{scope==='upcoming'?'Up next':'Read together'}</Text>{reads[scope].length>1?<Text style={{...note,fontSize:10}}>Swipe to explore</Text>:null}</View>
        {reads[scope].length?<ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled accessibilityLabel={scope==='upcoming'?'Upcoming club reads':'Past club reads'} contentContainerStyle={{gap:12,paddingBottom:3}}>{reads[scope].map(card)}</ScrollView>:<Text style={note}>{scope==='upcoming'?'The next chapter starts with your next club pick.':'Past club reads will collect here.'}</Text>}
        {reads[`${scope}_more`]?<Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`More ${scope} club reads`} onPress={()=>void more(scope)} style={{paddingVertical:14,alignItems:'center'}}><Text style={{...note,color:colors.gold}}>More books</Text></Pressable>:null}
      </View>)}
    </>}
    {busy?<ActivityIndicator color={colors.gold} style={{margin:12}}/>:null}
    <ClubReadActionsSheet visible={Boolean(target)} bookTitle={target?.book.title??'Club read'} status={target?.status??'upcoming'} onDismiss={()=>setTarget(null)} onAction={value=>{if(target)action(target,value);}}/>
    <DeletePostConfirmSheet visible={Boolean(removing)} busy={busy} title="Remove this club read?" message="This removes the book from your club’s reading lineup. Readers’ personal libraries and posts stay as they are." confirmLabel="Remove book" cancelLabel="Keep book" onConfirm={remove} onDismiss={()=>{if(!busy)setRemoving(null);}}/>
    <ValidationWarningSheet visible={Boolean(warning)} title="Club bookshelf" message={warning} onDismiss={()=>setWarning('')}/>
  </View>;
}
