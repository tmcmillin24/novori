import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { useEffect,useRef,useState } from 'react';
import { ActivityIndicator,Modal,Pressable,ScrollView,Text,TextInput,View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import BookCoverImage from '../components/BookCoverImage';
import ClubDiscussionPostAttachment from '../components/ClubDiscussionPostAttachment';
import EditablePostCard from '../components/EditablePostCard';
import SpoilerToggle from '../components/SpoilerToggle';
import ValidationWarningSheet from '../components/ValidationWarningSheet';
import { useNovoriTheme } from '../context/theme-context';
import usePostComposerProfile from '../hooks/use-post-composer-profile';
import { displayBookTitle } from '../lib/book-title';
import type { ClubDiscussion } from '../lib/club-discussion';
import { getClubDiscussion,newClubDiscussionRequestKey,saveClubDiscussion } from '../lib/club-discussions';
import type { ClubRead } from '../lib/club-read';
import { getClubRead,getClubReads } from '../lib/club-reads';
import { getClub,type ClubWithMembership } from '../lib/clubs';
import { supabase } from '../lib/supabase';

export default function CreateClubDiscussionScreen(){
  const router=useRouter(),params=useLocalSearchParams<{clubId?:string;discussionId?:string;readId?:string;kind?:string}>(),{colors}=useNovoriTheme();
  const clubId=typeof params.clubId==='string'?params.clubId:'',discussionId=typeof params.discussionId==='string'?params.discussionId:'',initialReadId=typeof params.readId==='string'?params.readId:'';
  const author=usePostComposerProfile();
  const [club,setClub]=useState<ClubWithMembership|null>(null),[discussion,setDiscussion]=useState<ClubDiscussion|undefined>(),[reads,setReads]=useState<ClubRead[]>([]),[readId,setReadId]=useState<string|null>(initialReadId||null);
  const [kind,setKind]=useState<'discussion'|'poll'>(params.kind==='poll'?'poll':'discussion'),[title,setTitle]=useState(''),[prompt,setPrompt]=useState(''),[spoilers,setSpoilers]=useState(false),[options,setOptions]=useState(['','']);
  const [ownsDiscussion,setOwnsDiscussion]=useState(false);
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[saving,setSaving]=useState(false),[warning,setWarning]=useState(''),[picker,setPicker]=useState(false),[pageBusy,setPageBusy]=useState(false),[more,setMore]=useState({upcoming:false,past:false});
  const offsets=useRef({upcoming:0,past:0}),active=useRef(true),busy=useRef(false),requestKey=useRef(newClubDiscussionRequestKey());
  useEffect(()=>{let current=true;active.current=true;(async()=>{
    try{const [group,item,lineup,selected]=await Promise.all([getClub(clubId),discussionId?getClubDiscussion(discussionId):Promise.resolve(undefined),getClubReads(clubId),initialReadId?getClubRead(initialReadId):Promise.resolve(null)]);
      if(discussionId&&!item)throw Error('This discussion is unavailable.');
      const session=item&&!item.viewer_can_manage&&item.created_by
        ? (await supabase.auth.getSession()).data.session : null;
      if(!current)return;
      setOwnsDiscussion(Boolean(session?.user.id && session.user.id===item?.created_by));
      if(item&&item.club_id!==clubId||selected&&selected.club_id!==clubId)throw Error('Choose a discussion and read from this club.');
      const all=[...(lineup.current?[lineup.current]:[]),...lineup.upcoming,...lineup.past,...(selected?[selected]:[])];
      setClub(group);setDiscussion(item);setReads([...new Map(all.map(read=>[read.id,read])).values()]);setMore({upcoming:lineup.upcoming_more,past:lineup.past_more});offsets.current={upcoming:lineup.upcoming.length,past:lineup.past.length};
      if(item){setReadId(item.read_id);setKind(item.kind);setTitle(item.title);setPrompt(item.prompt);setSpoilers(item.contains_spoilers);setOptions(item.options.length?item.options:['','']);}
      else if(!initialReadId&&params.kind!=='poll')setReadId(lineup.current?.id??null);
    }catch(error){if(current)setLoadError((error as {message?:string})?.message||'Could not load this club.');}finally{if(current)setLoading(false);}
  })();return()=>{current=false;active.current=false;};},[clubId,discussionId,initialReadId]);
  async function loadMore(scope:'upcoming'|'past'){if(pageBusy)return;setPageBusy(true);try{const page=await getClubReads(clubId,scope,offsets.current[scope]);if(active.current){offsets.current[scope]+=page[scope].length;setReads(current=>[...new Map([...current,...page[scope]].map(read=>[read.id,read])).values()]);setMore(current=>({...current,[scope]:page[`${scope}_more`]}));}}catch(error){if(active.current)setWarning((error as {message?:string})?.message||'Could not load more club reads.');}finally{if(active.current)setPageBusy(false);}}
  const editable=Boolean(club?.membership_role)&&(!discussion||discussion.viewer_can_manage||ownsDiscussion),locked=Boolean(discussion?.kind==='poll'&&(discussion.voting_started_at||discussion.closed_at));
  const selected=reads.find(read=>read.id===readId),book=selected?.book??(discussion&&readId===discussion.read_id?discussion.book:null);
  async function save(){if(!editable||locked||busy.current)return;busy.current=true;setSaving(true);try{const postId=await saveClubDiscussion(clubId,{read_id:readId,kind,title,prompt,contains_spoilers:spoilers,spoiler_label:spoilers?(discussion?.spoiler_label?.trim()||'Whole book'):null,options},discussion,requestKey.current);if(active.current){if(discussion)router.back();else router.replace({pathname:'/post/[id]',params:{id:postId}});}}catch(error){if(active.current)setWarning((error as {message?:string})?.message||'Could not publish this discussion.');}finally{busy.current=false;if(active.current)setSaving(false);}}
  const copy={color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:12},input={color:colors.text,fontFamily:'Inter_400Regular',fontSize:13,lineHeight:20,paddingVertical:12};
  return <SafeAreaView style={{flex:1,backgroundColor:colors.background}} edges={['top','bottom']}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:16}}><Pressable disabled={saving} accessibilityRole="button" accessibilityLabel="Close discussion editor" onPress={()=>router.back()} style={{padding:8}}><Ionicons name="close" size={24} color={colors.text}/></Pressable><Text style={{...copy,fontFamily:'PlayfairDisplay_700Bold',fontSize:21}}>{kind==='poll'?'Club poll':'Club discussion'}</Text><Pressable disabled={loading||saving||!editable||locked||Boolean(loadError)} accessibilityRole="button" accessibilityLabel="Publish club discussion" onPress={()=>void save()} style={{padding:11,borderRadius:11,backgroundColor:colors.gold,opacity:(loading||saving||!editable||locked) ? .6 : 1}}><Text style={{...copy,color:colors.background}}>{saving?'Saving…':discussion?'Save':'Post'}</Text></Pressable></View>
    {loading?<ActivityIndicator color={colors.gold} style={{margin:25}}/>:loadError||!editable||locked?<View style={{padding:25}}><Text style={{...copy,color:colors.mutedText,lineHeight:20}}>{loadError||(locked?'Polls lock after the first vote. You can close this poll from its post and create a new one.':'Join this club to create discussions. Only the creator or club hosts can edit them.')}</Text></View>:<KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={24} contentContainerStyle={{padding:18,paddingBottom:40,maxWidth: '100%',width:'100%',alignSelf:'center'}}>
      {!discussion ? <View style={{flexDirection:'row',gap:8,marginBottom:14}}>{(['discussion','poll'] as const).map(value=><Pressable key={value} accessibilityRole="button" accessibilityLabel={`Create ${value}`} accessibilityState={{selected:kind===value}} onPress={()=>setKind(value)} style={{flex:1,padding:12,borderRadius:11,borderWidth:1,borderColor:kind===value?colors.gold:colors.border,backgroundColor:kind===value?`${colors.gold}15`:colors.surface}}><Text style={{...copy,textAlign:'center',color:kind===value?colors.gold:colors.mutedText}}>{value==='poll'?'Poll':'Discussion'}</Text></Pressable>)}</View> : null}
      <EditablePostCard postType="post" author={author} clubId={clubId} clubName={club?.name} clubCoverUrl={club?.cover_url} discussionLabel>
      <ClubDiscussionPostAttachment detail draft revealed discussion={{
        id:'draft',club_id:clubId,post_id:'',read_id:readId,created_by:null,kind,title,prompt,book,
        contains_spoilers:spoilers,spoiler_label:null,options:kind==='poll'?options:[],
        closed_at:null,voting_started_at:null,created_at:'',updated_at:'',
      }} editor={<>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose discussion club read" onPress={()=>setPicker(true)} style={{paddingVertical:13}}><Text style={{...copy,color:colors.gold}}>{book?'Change club read':'Attach a club read (optional)'}</Text></Pressable>
        <TextInput accessibilityLabel="Discussion title" value={title} onChangeText={setTitle} placeholder={kind==='poll'?'What should we vote on?':'Start a conversation…'} placeholderTextColor={colors.mutedText} multiline maxLength={160} style={{...input,fontFamily:'PlayfairDisplay_700Bold',fontSize:23,lineHeight:29,paddingVertical:0}}/>
        <TextInput accessibilityLabel="Discussion prompt" value={prompt} onChangeText={setPrompt} placeholder={kind==='poll'?'Add context (optional)':'Your question or thoughts…'} placeholderTextColor={colors.mutedText} multiline maxLength={3000} style={{...input,color:colors.secondaryText,fontSize:12,lineHeight:19,marginTop:10,paddingVertical:0}}/>
        {kind==='poll'?<View>{options.map((option,index)=><View key={index} style={{flexDirection:'row',alignItems:'center',gap:7,marginBottom:7}}><TextInput accessibilityLabel={`Poll choice ${index+1}`} value={option} onChangeText={value=>setOptions(current=>current.map((old,i)=>i===index?value:old))} placeholder={`Choice ${index+1}`} placeholderTextColor={colors.mutedText} maxLength={140} style={{...input,flex:1,minHeight:45,padding:11,borderWidth:1,borderRadius:10,borderColor:colors.border}}/>{options.length>2?<Pressable accessibilityRole="button" accessibilityLabel={`Remove poll choice ${index+1}`} onPress={()=>setOptions(current=>current.filter((_,i)=>i!==index))} style={{padding:8}}><Ionicons name="close-circle-outline" size={19} color={colors.mutedText}/></Pressable>:null}</View>)}{options.length<6?<Pressable accessibilityRole="button" accessibilityLabel="Add poll choice" onPress={()=>setOptions(current=>[...current,''])} style={{paddingVertical:14}}><Text style={{...copy,color:colors.gold}}>Add choice</Text></Pressable>:null}<Text style={{...copy,color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:10,lineHeight:16,marginTop:8}}>One vote per member. Choices lock after the first vote; the creator or club hosts can close voting.</Text></View>:null}
        <SpoilerToggle value={spoilers} onChange={setSpoilers} disabled={saving}/>
      </>}/>
      </EditablePostCard>
    </KeyboardAwareScrollView>}
    <Modal supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} visible={picker} animationType="fade" onRequestClose={()=>setPicker(false)}><SafeAreaView style={{flex:1,backgroundColor:colors.background}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:18}}><Text style={{...copy,fontFamily:'PlayfairDisplay_700Bold',fontSize:22}}>Your club’s reads</Text><Pressable accessibilityRole="button" accessibilityLabel="Close club read picker" onPress={()=>setPicker(false)} style={{padding:8}}><Ionicons name="close" size={24} color={colors.text}/></Pressable></View><ScrollView contentContainerStyle={{padding:18}}>
      <Pressable accessibilityRole="button" accessibilityLabel="No discussion book" onPress={()=>{setReadId(null);setPicker(false);}} style={{paddingVertical:15}}><Text style={{...copy,color:colors.gold}}>General club conversation</Text></Pressable>
      {reads.map(read=><Pressable key={read.id} accessibilityRole="button" accessibilityLabel={`Discuss club read: ${read.book.title}`} onPress={()=>{setReadId(read.id);setPicker(false);}} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.border}}><BookCoverImage googleBookId={read.book.googleBookId} isbn={read.book.isbn} existingCoverUrl={read.book.coverUrl} style={{width:43,height:65,borderRadius:5}}/><View style={{flex:1}}><Text style={copy}>{displayBookTitle(read.book.title ?? '')}</Text><Text style={{...copy,color:colors.mutedText,fontSize:10,marginTop:5}}>{read.status.toUpperCase()} · {read.book.authors.join(', ')}</Text></View></Pressable>)}
      {!reads.length?<Text style={{...copy,color:colors.mutedText}}>Add books to your club’s Books tab to discuss a shared read.</Text>:null}
      {(['upcoming','past'] as const).map(scope=>more[scope]?<Pressable key={scope} disabled={pageBusy} accessibilityRole="button" accessibilityLabel={`More ${scope} discussion books`} onPress={()=>void loadMore(scope)} style={{paddingVertical:16}}><Text style={{...copy,color:colors.gold}}>More {scope} reads</Text></Pressable>:null)}
    </ScrollView></SafeAreaView></Modal>
    <ValidationWarningSheet visible={Boolean(warning)} title="Check your discussion" message={warning} onDismiss={()=>setWarning('')}/>
  </SafeAreaView>;
}
