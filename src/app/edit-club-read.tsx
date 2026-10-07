import { displayBookTitle } from '../lib/book-title';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { useEffect,useRef,useState } from 'react';
import { ActivityIndicator,Pressable,Text,TextInput,View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import BookCoverImage from '../components/BookCoverImage';
import ClubBookPicker from '../components/ClubBookPicker';
import ClubReadDateField from '../components/ClubReadDateField';
import ValidationWarningSheet from '../components/ValidationWarningSheet';
import { useNovoriTheme } from '../context/theme-context';
import { getClub,type ClubWithMembership } from '../lib/clubs';
import { canManageClubPosts } from '../lib/club-posts';
import { getClubRead,saveClubRead,newClubReadRequestKey } from '../lib/club-reads';
import type { ClubRead,ClubReadStatus } from '../lib/club-read';
import type { ClubEventBook } from '../lib/club-event';
import { getNovoriSearchBookCover,getNovoriSearchBookIsbn,resolveNovoriSearchBookCover,type GoogleBookSearchItem } from '../lib/book-search';

export default function EditClubReadScreen() {
  const router=useRouter(),params=useLocalSearchParams<{clubId?:string;readId?:string;status?:string}>(),{colors}=useNovoriTheme();
  const clubId=typeof params.clubId==='string'?params.clubId:'',readId=typeof params.readId==='string'?params.readId:'';
  const [club,setClub]=useState<ClubWithMembership|null>(null),[read,setRead]=useState<ClubRead|undefined>(),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
  const [book,setBook]=useState<ClubEventBook|null>(null),[status,setStatus]=useState<ClubReadStatus>(params.status==='current'?'current':params.status==='past'?'past':'upcoming');
  const [start,setStart]=useState<string|null>(null),[end,setEnd]=useState<string|null>(null),[note,setNote]=useState(''),[picker,setPicker]=useState(false),[warning,setWarning]=useState(''),[saving,setSaving]=useState(false);
  const busy=useRef(false),selectionVersion=useRef(0),requestKey=useRef(newClubReadRequestKey()),active=useRef(true);
  useEffect(()=>{let current=true;active.current=true;(async()=>{
    try{const [group,item]=await Promise.all([getClub(clubId),readId?getClubRead(readId):Promise.resolve(undefined)]);
      if(!current)return;if(item&&item.club_id!==clubId)throw Error('This read belongs to another club.');setClub(group);setRead(item);
      if(item){setBook(item.book);setStatus(item.status);setStart(item.started_on);setEnd(item.ended_on);setNote(item.note);}
    }catch(error){if(current)setLoadError((error as {message?:string})?.message||'Could not load the club read.');}finally{if(current)setLoading(false);}
  })();return()=>{current=false;active.current=false;selectionVersion.current++;};},[clubId,readId]);
  async function choose(item:GoogleBookSearchItem){const version=++selectionVersion.current;
    const chosen={googleBookId:item.id,isbn:getNovoriSearchBookIsbn(item),title:item.volumeInfo.title??'Untitled',authors:item.volumeInfo.authors??[],coverUrl:getNovoriSearchBookCover(item)};
    setBook(chosen);setPicker(false);
    try{const coverUrl=await resolveNovoriSearchBookCover(item);if(active.current&&version===selectionVersion.current)setBook({...chosen,coverUrl:coverUrl??chosen.coverUrl});}catch{} // Preserve the selected identity and existing cover.
  }
  const manager=canManageClubPosts(club?.membership_role);
  async function save(){if(!manager||busy.current)return;if(!book){setWarning('Choose a book for your club.');return;}
    try{busy.current=true;setSaving(true);await saveClubRead(clubId,{book,status,started_on:start,ended_on:end,note},read,requestKey.current);if(active.current)router.back();}
    catch(error){if(active.current)setWarning((error as {message?:string})?.message||'Could not save the club read.');}finally{busy.current=false;if(active.current)setSaving(false);}
  }
  const copy={color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:12};
  return <SafeAreaView style={{flex:1,backgroundColor:colors.background}} edges={['top','bottom']}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:18,paddingVertical:12}}><Pressable disabled={saving} accessibilityRole="button" accessibilityLabel="Close club read editor" onPress={()=>router.back()} style={{padding:8}}><Ionicons name="close" size={24} color={colors.text}/></Pressable><Text style={{...copy,fontFamily:'PlayfairDisplay_700Bold',fontSize:21}}>{readId?'Edit club read':'Add club read'}</Text><Pressable disabled={loading||saving||!manager||Boolean(loadError)} accessibilityRole="button" accessibilityLabel="Save club read" onPress={()=>void save()} style={{paddingVertical:10,paddingHorizontal:16,borderRadius:12,backgroundColor:colors.gold,opacity:(loading||saving||!manager) ? .75 : 1}}><Text style={{...copy,color:colors.background}}>{saving?'Saving…':'Save'}</Text></Pressable></View>
    {loading?<ActivityIndicator color={colors.gold} style={{margin:30}}/>:loadError||!manager?<Text style={{...copy,color:colors.mutedText,padding:25}}>{loadError||'Only club owners and admins can manage shared reads.'}</Text>:<KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={24} contentContainerStyle={{padding:18,paddingBottom:40,maxWidth: '100%',width:'100%',alignSelf:'center'}}>
      <View style={{backgroundColor:colors.surface,borderWidth:1,borderColor:`${colors.gold}50`,borderRadius:20,overflow:'hidden'}}><View style={{height:3,backgroundColor:colors.gold}}/><View style={{padding:16}}>
        <Text style={{...copy,color:colors.gold,fontSize:10,letterSpacing:.7}}>YOUR CLUB’S READING LINEUP</Text><Text style={{...copy,color:colors.mutedText,fontSize:11,marginTop:7,marginBottom:16}}>in {club?.name}</Text>
        {book?<View style={{flexDirection:'row',alignItems:'center',gap:14}}><BookCoverImage googleBookId={book.googleBookId} isbn={book.isbn} existingCoverUrl={book.coverUrl} style={{width:79,height:119,borderRadius:6,backgroundColor:colors.elevated}}/><View style={{flex:1}}><Text style={{...copy,fontFamily:'PlayfairDisplay_700Bold',fontSize:24,lineHeight:29}}>{displayBookTitle(book.title ?? '')}</Text><Text style={{...copy,color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:11,lineHeight:17,marginTop:6}}>{book.authors.join(', ')}</Text></View></View>:null}
        <Pressable accessibilityRole="button" accessibilityLabel="Choose club read book" onPress={()=>setPicker(true)} style={{flexDirection:'row',alignItems:'center',gap:8,minHeight:48,marginVertical:7}}><Ionicons name="book-outline" size={20} color={colors.gold}/><Text style={{...copy,color:colors.gold}}>{book?'Change book':'Choose your club’s book'}</Text></Pressable>
        <View style={{flexDirection:'row',gap:6}}>{(['current','upcoming','past'] as const).map(option=><Pressable key={option} accessibilityRole="button" accessibilityLabel={`Club read status ${option}`} accessibilityState={{selected:status===option}} onPress={()=>setStatus(option)} style={{flex:1,minHeight:43,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:status===option?colors.gold:colors.border,borderRadius:10,backgroundColor:status===option?`${colors.gold}15`:colors.elevated}}><Text style={{...copy,fontSize:11,color:status===option?colors.gold:colors.secondaryText}}>{option==='current'?'Current':option==='upcoming'?'Upcoming':'Past'}</Text></Pressable>)}</View>
        {status==='current'?<Text style={{...copy,color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:11,lineHeight:17,marginTop:11}}>Making this the current read moves the previous one to past reads.</Text>:null}
        <ClubReadDateField label="Start date" value={start} onChange={setStart}/><ClubReadDateField label="End date" value={end} onChange={setEnd}/>
        <Text style={{...copy,color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:10,lineHeight:16,marginTop:7}}>Dates help your club plan. You decide when to start or finish a shared read.</Text>
        <TextInput accessibilityLabel="Club read note" value={note} onChangeText={setNote} placeholder="A note for your readers… (optional)" placeholderTextColor={colors.mutedText} multiline maxLength={1000} style={{...copy,fontFamily:'Inter_400Regular',fontSize:13,lineHeight:20,paddingVertical:15,marginTop:9}}/>
      </View></View>
    </KeyboardAwareScrollView>}
    <ClubBookPicker visible={picker} onDismiss={()=>setPicker(false)} onChoose={item=>void choose(item)}/>
    <ValidationWarningSheet visible={Boolean(warning)} title="Check your club read" message={warning} onDismiss={()=>setWarning('')}/>
  </SafeAreaView>;
}
