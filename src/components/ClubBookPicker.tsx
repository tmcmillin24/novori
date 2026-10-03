import { Ionicons } from '@expo/vector-icons';
import { useEffect,useState } from 'react';
import { ActivityIndicator,Modal,Pressable,ScrollView,Text,TextInput,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNovoriTheme } from '../context/theme-context';
import { searchNovoriBooks,getNovoriSearchBookCover,getNovoriSearchBookIsbn,type GoogleBookSearchItem } from '../lib/book-search';
import BookCoverImage from './BookCoverImage';

export default function ClubBookPicker({visible,onDismiss,onChoose}:{visible:boolean;onDismiss:()=>void;onChoose:(book:GoogleBookSearchItem)=>void}) {
  const {colors}=useNovoriTheme();const [query,setQuery]=useState(''),[results,setResults]=useState<GoogleBookSearchItem[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{if(!visible){setQuery('');setResults([]);setBusy(false);setError('');}},[visible]);
  useEffect(()=>{if(!visible)return;let active=true;setResults([]);setError('');setBusy(Boolean(query.trim()));
    if(!query.trim())return;const timer=setTimeout(async()=>{
      try{const books=await searchNovoriBooks(query.trim());if(active)setResults(books);}catch(error){if(active)setError((error as {message?:string})?.message||'Could not search books.');}finally{if(active)setBusy(false);}
    },350);return()=>{active=false;clearTimeout(timer);};
  },[visible,query]);
  const copy={color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:13};
  return <Modal visible={visible} animationType="fade" onRequestClose={onDismiss}><SafeAreaView style={{flex:1,backgroundColor:colors.background}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:18}}><Text style={{...copy,fontFamily:'PlayfairDisplay_700Bold',fontSize:22}}>Choose a book</Text><Pressable accessibilityRole="button" accessibilityLabel="Close club book search" onPress={onDismiss} style={{padding:8}}><Ionicons name="close" size={25} color={colors.text}/></Pressable></View>
    <View style={{flexDirection:'row',alignItems:'center',marginHorizontal:18,paddingHorizontal:12,borderWidth:1,borderColor:colors.border,borderRadius:12,backgroundColor:colors.surface}}>
      <Ionicons name="search-outline" size={18} color={colors.mutedText}/><TextInput accessibilityLabel="Club book search" value={query} onChangeText={setQuery} autoFocus placeholder="Search title or author" placeholderTextColor={colors.mutedText} style={{...copy,flex:1,padding:13,fontFamily:'Inter_400Regular'}}/>
      {query?<Pressable accessibilityRole="button" accessibilityLabel="Clear club book search" onPress={()=>setQuery('')} style={{padding:8}}><Ionicons name="close-circle" size={18} color={colors.mutedText}/></Pressable>:null}
    </View>
    {busy?<ActivityIndicator color={colors.gold} style={{margin:16}}/>:error||query.trim()&&!results.length?<Text style={{...copy,color:colors.mutedText,margin:18}}>{error||'No books found. Try another title or author.'}</Text>:null}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:18}}>{results.map(book=><Pressable key={book.id} accessibilityRole="button" accessibilityLabel={`Choose club book: ${book.volumeInfo.title}`} onPress={()=>onChoose(book)} style={{flexDirection:'row',alignItems:'center',gap:13,paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.border}}>
      <BookCoverImage googleBookId={book.id} isbn={getNovoriSearchBookIsbn(book)} existingCoverUrl={getNovoriSearchBookCover(book)} style={{width:49,height:74,borderRadius:5}}/>
      <View style={{flex:1}}><Text style={copy}>{book.volumeInfo.title}</Text><Text style={{...copy,fontFamily:'Inter_400Regular',fontSize:11,color:colors.mutedText,marginTop:5}}>{book.volumeInfo.authors?.join(', ')}</Text></View>
    </Pressable>)}</ScrollView>
  </SafeAreaView></Modal>;
}
