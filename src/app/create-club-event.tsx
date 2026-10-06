import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { useEffect,useMemo,useRef,useState } from 'react';
import { ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import BookCoverImage from '../components/BookCoverImage';
import EventDateTimeField from '../components/EventDateTimeField';
import ValidationWarningSheet from '../components/ValidationWarningSheet';
import { useNovoriTheme } from '../context/theme-context';
import { getClub,type ClubWithMembership } from '../lib/clubs';
import { canManageClubPosts } from '../lib/club-posts';
import { getClubEvent,newClubEventRequestKey,saveClubEvent } from '../lib/club-events';
import { isUpcomingClubEvent,localClubEventFields,localClubEventInstant,type ClubEvent,type ClubEventBook } from '../lib/club-event';
import { searchNovoriBooks,getNovoriSearchBookCover,getNovoriSearchBookIsbn,resolveNovoriSearchBookCover,type GoogleBookSearchItem } from '../lib/book-search';

export default function CreateClubEventScreen() {
  const router = useRouter();const params = useLocalSearchParams<{clubId?:string;eventId?:string}>();
  const clubId = typeof params.clubId==='string'?params.clubId:'';const eventId = typeof params.eventId==='string'?params.eventId:'';
  const {colors} = useNovoriTheme();const styles = useMemo(()=>StyleSheet.create({
    safe:{flex:1,backgroundColor:colors.background},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:18,paddingVertical:12},
    close:{padding:7},heading:{color:colors.text,fontFamily:'PlayfairDisplay_700Bold',fontSize:20},save:{paddingVertical:9,paddingHorizontal:16,borderRadius:12,backgroundColor:colors.gold},saveText:{color:colors.background,fontFamily:'Inter_700Bold',fontSize:12},
    content:{padding:18,paddingBottom:40,maxWidth:720,width:'100%',alignSelf:'center'},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:`${colors.gold}50`,borderRadius:20,padding:16},
    eyebrow:{color:colors.gold,fontFamily:'Inter_700Bold',fontSize:10,letterSpacing:.8,marginBottom:8},club:{color:colors.mutedText,fontFamily:'Inter_500Medium',fontSize:11,marginBottom:13},
    title:{color:colors.text,fontFamily:'PlayfairDisplay_700Bold',fontSize:25,paddingVertical:8},input:{color:colors.text,fontFamily:'Inter_400Regular',fontSize:13,lineHeight:20,paddingVertical:10},
    modes:{flexDirection:'row',gap:8,marginTop:16},mode:{flex:1,padding:11,borderRadius:10,alignItems:'center',borderWidth:1,borderColor:colors.border},modeText:{color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:12},
    help:{color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:11,lineHeight:17,marginTop:14},book:{flexDirection:'row',alignItems:'center',gap:11,marginTop:14},cover:{width:45,height:68,borderRadius:5,backgroundColor:colors.elevated},bookTitle:{color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:12},bookAuthor:{color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:10,marginTop:4},
    addBook:{flexDirection:'row',gap:7,alignItems:'center',paddingVertical:14},addText:{color:colors.gold,fontFamily:'Inter_600SemiBold',fontSize:12},center:{padding:25,alignItems:'center'},picker:{flex:1,backgroundColor:colors.background},result:{flexDirection:'row',gap:12,padding:13,alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},pressed:{opacity:.7},
  }),[colors]);
  const [loading,setLoading] = useState(true),[club,setClub] = useState<ClubWithMembership|null>(null),[event,setEvent] = useState<ClubEvent|undefined>();
  const [title,setTitle] = useState(''),[description,setDescription] = useState(''),[kind,setKind] = useState<'in_person'|'virtual'>('in_person'),[location,setLocation] = useState(''),[meetingUrl,setMeetingUrl] = useState(''),[book,setBook] = useState<ClubEventBook|null>(null);
  const defaults = useMemo(()=>{const start=new Date();start.setDate(start.getDate()+1);start.setHours(18,0,0,0);return {start:start.toISOString(),end:new Date(start.getTime()+3600000).toISOString()};},[]);
  const [start,setStart] = useState(()=>localClubEventFields(defaults.start)),[end,setEnd] = useState(()=>localClubEventFields(defaults.end));
  const [saving,setSaving] = useState(false),[warning,setWarning] = useState(''),[loadError,setLoadError] = useState('');
  const [picker,setPicker] = useState(false),[query,setQuery] = useState(''),[results,setResults] = useState<GoogleBookSearchItem[]>([]),[searching,setSearching] = useState(false),[searchError,setSearchError] = useState('');
  const saveBusy = useRef(false),requestKey = useRef(newClubEventRequestKey()),selectionVersion = useRef(0);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  useEffect(()=>{let active=true;(async()=>{
    try { const [loadedClub,loadedEvent]=await Promise.all([getClub(clubId),eventId?getClubEvent(eventId):Promise.resolve(undefined)]);
      if (!active) return;if (loadedEvent && loadedEvent.club_id!==clubId) throw Error('This event belongs to another club.');
      setClub(loadedClub);setEvent(loadedEvent);
      if (loadedEvent) {setTitle(loadedEvent.title);setDescription(loadedEvent.description);setKind(loadedEvent.kind);setLocation(loadedEvent.location??'');setMeetingUrl(loadedEvent.meeting_url??'');setBook(loadedEvent.book);setStart(localClubEventFields(loadedEvent.starts_at));setEnd(localClubEventFields(loadedEvent.ends_at));}
    } catch(error) {if(active)setLoadError((error as {message?:string})?.message||'Could not load this club.');}finally{if(active)setLoading(false);}
  })();return()=>{active=false;selectionVersion.current++;};},[clubId,eventId]);
  useEffect(()=>{if(!picker)return;let active=true;setSearchError('');setSearching(Boolean(query.trim()));if(!query.trim()){setResults([]);return;}const timer=setTimeout(async()=>{
    try {const books=await searchNovoriBooks(query.trim());if(active)setResults(books);}catch(error){if(active){setResults([]);setSearchError((error as {message?:string})?.message||'Could not search books.');}}finally{if(active)setSearching(false);}
  },350);return()=>{active=false;clearTimeout(timer);};},[picker,query]);
  async function chooseBook(item:GoogleBookSearchItem) {
    const version=++selectionVersion.current;
    const selected={googleBookId:item.id,isbn:getNovoriSearchBookIsbn(item),title:item.volumeInfo.title??'Untitled',authors:item.volumeInfo.authors??[],coverUrl:getNovoriSearchBookCover(item)};
    setBook(selected);setPicker(false);setQuery('');
    try {const coverUrl=await resolveNovoriSearchBookCover(item);if(selectionVersion.current===version)setBook({...selected,coverUrl:coverUrl??selected.coverUrl});}catch{} // Keep the selected, existing canonical identity.
  }
  function changeStart(value: typeof start) {
    setStart(value);
    try {const from=Date.parse(localClubEventInstant(value.day,value.hour,value.minute,value.pm));const until=Date.parse(localClubEventInstant(end.day,end.hour,end.minute,end.pm));if(until<=from)setEnd(localClubEventFields(new Date(from+3600000).toISOString()));} catch {}
  }
  async function save() {
    if(saveBusy.current||!club||!canManageClubPosts(club.membership_role))return;
    try {saveBusy.current=true;setSaving(true);
      const id=await saveClubEvent(clubId,{title,description,kind,location,meeting_url:meetingUrl,book,timezone,
        starts_at:localClubEventInstant(start.day,start.hour,start.minute,start.pm),ends_at:localClubEventInstant(end.day,end.hour,end.minute,end.pm)},event,requestKey.current);
      if(event)router.back();else router.replace({pathname:'/club-event/[id]',params:{id}});
    }catch(error){setWarning((error as {message?:string})?.message||'Could not save the event. Try again.');}finally{saveBusy.current=false;setSaving(false);}
  }
  const editable=club&&canManageClubPosts(club.membership_role)&&(!event||isUpcomingClubEvent(event));
  return <SafeAreaView style={styles.safe} edges={['top','bottom']}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Close event editor" onPress={()=>router.back()} style={styles.close}><Ionicons name="close" size={24} color={colors.text}/></Pressable><Text style={styles.heading}>{eventId?'Edit event':'Create event'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Save club event" disabled={saving||loading||!editable} onPress={()=>void save()} style={[styles.save,(saving||loading||!editable)&&{opacity:.45}]}>{saving?<ActivityIndicator color={colors.background}/>:<Text style={styles.saveText}>{eventId?'Save':'Create'}</Text>}</Pressable></View>
    {loading?<View style={styles.center}><ActivityIndicator color={colors.gold}/></View>:loadError||!editable?<View style={styles.center}><Text style={styles.help}>{loadError||'Only owners and admins can edit upcoming club events.'}</Text></View>:<KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={24} contentContainerStyle={styles.content}>
      <View style={styles.card}><Text style={styles.eyebrow}>CLUB EVENT</Text><Text style={styles.club}>in {club?.name}</Text>
        <TextInput accessibilityLabel="Event title" value={title} onChangeText={setTitle} placeholder="Name your event…" placeholderTextColor={colors.mutedText} maxLength={120} style={styles.title}/>
        <TextInput accessibilityLabel="Event description" value={description} onChangeText={setDescription} placeholder="What are we getting together for? (optional)" placeholderTextColor={colors.mutedText} multiline maxLength={2000} style={styles.input}/>
        <EventDateTimeField label="Start" value={start} onChange={changeStart}/><EventDateTimeField label="End" value={end} onChange={setEnd}/>
        <Text style={styles.help}>Times are in {timezone}. Readers see their own local time.</Text>
        <View style={styles.modes}>{(['in_person','virtual'] as const).map(option=><Pressable key={option} accessibilityRole="button" accessibilityLabel={option==='virtual'?'Virtual event':'In-person event'} accessibilityState={{selected:kind===option}} onPress={()=>setKind(option)} style={[styles.mode,kind===option&&{borderColor:colors.gold,backgroundColor:`${colors.gold}12`}]}><Text style={styles.modeText}>{option==='virtual'?'Virtual':'In person'}</Text></Pressable>)}</View>
        {kind==='in_person'?<TextInput accessibilityLabel="Event location" value={location} onChangeText={setLocation} placeholder="Where are we meeting?" placeholderTextColor={colors.mutedText} maxLength={300} style={styles.input}/>:<TextInput accessibilityLabel="Event meeting link" value={meetingUrl} onChangeText={setMeetingUrl} placeholder="https://…" placeholderTextColor={colors.mutedText} autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={2048} style={styles.input}/>}
        {book?<View style={styles.book}><BookCoverImage googleBookId={book.googleBookId} isbn={book.isbn} existingCoverUrl={book.coverUrl} style={styles.cover}/><View style={{flex:1}}><Text style={styles.bookTitle}>{book.title}</Text><Text style={styles.bookAuthor}>{book.authors.join(', ')}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Remove event book" onPress={()=>{selectionVersion.current++;setBook(null);}} style={{padding:8}}><Ionicons name="close" size={20} color={colors.mutedText}/></Pressable></View>:null}
        <Pressable accessibilityRole="button" accessibilityLabel="Choose event book" onPress={()=>setPicker(true)} style={styles.addBook}><Ionicons name="book-outline" size={17} color={colors.gold}/><Text style={styles.addText}>{book?'Change book':'Add a book (optional)'}</Text></Pressable>
      </View>
    </KeyboardAwareScrollView>}
    <Modal supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} visible={picker} animationType="fade" onRequestClose={()=>setPicker(false)}><SafeAreaView style={styles.picker}><View style={styles.header}><Text style={styles.heading}>Choose a book</Text><Pressable accessibilityRole="button" accessibilityLabel="Close event book search" onPress={()=>setPicker(false)}><Ionicons name="close" size={25} color={colors.text}/></Pressable></View>
      <TextInput accessibilityLabel="Event book search" value={query} onChangeText={setQuery} placeholder="Search title or author" placeholderTextColor={colors.mutedText} autoFocus style={[styles.input,{marginHorizontal:18}]}/>
      {searching?<ActivityIndicator color={colors.gold}/>:null}{searchError?<Text style={[styles.help,{margin:18}]}>{searchError}</Text>:!searching&&query.trim()&&!results.length?<Text style={[styles.help,{margin:18}]}>No books found. Try another title or author.</Text>:null}
      <ScrollView keyboardShouldPersistTaps="handled">{results.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Choose book: ${item.volumeInfo.title}`} onPress={()=>void chooseBook(item)} style={styles.result}><BookCoverImage googleBookId={item.id} isbn={getNovoriSearchBookIsbn(item)} existingCoverUrl={getNovoriSearchBookCover(item)} style={styles.cover}/><View style={{flex:1}}><Text style={styles.bookTitle}>{item.volumeInfo.title}</Text><Text style={styles.bookAuthor}>{item.volumeInfo.authors?.join(', ')}</Text></View></Pressable>)}</ScrollView>
    </SafeAreaView></Modal>
    <ValidationWarningSheet visible={Boolean(warning)} title="Check your event" message={warning} onDismiss={()=>setWarning('')}/>
  </SafeAreaView>;
}
