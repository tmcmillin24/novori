import BookSearchRatings from './BookSearchRatings';
import { displayBookTitle } from '../lib/book-title';
import { Ionicons } from '@expo/vector-icons';
import { useEffect,useRef,useState } from 'react';
import { ActivityIndicator,Modal,Pressable,ScrollView,Text,TextInput,View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useNovoriTheme } from '../context/theme-context';
import { searchNovoriBooks,getNovoriSearchBookCover,getNovoriSearchBookIsbn,type GoogleBookSearchItem } from '../lib/book-search';
import BookCoverImage from './BookCoverImage';

export default function ClubBookPicker({visible,onDismiss,onChoose}:{visible:boolean;onDismiss:()=>void;onChoose:(book:GoogleBookSearchItem)=>void}) {
  const {colors}=useNovoriTheme();const [query,setQuery]=useState(''),[results,setResults]=useState<GoogleBookSearchItem[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submitSearch = useRef<(() => void) | null>(null);
  const term = query.normalize('NFKC').trim().replace(/\s+/g, ' ');
  useEffect(() => {
    setResults([]);
    setError('');
    if (!visible) setQuery('');
    if (!visible || term.length < 2) {
      setBusy(false);
      return;
    }
    let active = true;
    let started = false;
    let hasResults = false;
    setBusy(true);
    async function run() {
      if (!active || started) return;
      started = true;
      try {
        const books = await searchNovoriBooks(term, 0, {
          onProgress: partial => {
            if (!active || !partial.length) return;
            hasResults = true;
            setResults(partial);
            setBusy(false);
          },
        });
        if (active && (books.length || !hasResults)) setResults(books);
      } catch {
        if (active && !hasResults) setError('Could not search books. Try again.');
      } finally {
        if (active) setBusy(false);
      }
    }
    const timer = setTimeout(() => void run(), 260);
    submitSearch.current = () => { clearTimeout(timer); void run(); };
    return () => {
      active = false;
      clearTimeout(timer);
      submitSearch.current = null;
    };
  }, [visible, term]);
  const copy={color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:13};
  return <Modal supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onDismiss}>
    <SafeAreaProvider style={{flex:1,backgroundColor:colors.background}}>
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{flex:1,backgroundColor:colors.background}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:18}}><Text style={{...copy,fontFamily:'PlayfairDisplay_700Bold',fontSize:22}}>Choose a book</Text><Pressable accessibilityRole="button" accessibilityLabel="Close club book search" onPress={onDismiss} style={{padding:8}}><Ionicons name="close" size={25} color={colors.text}/></Pressable></View>
    <View style={{flexDirection:'row',alignItems:'center',marginHorizontal:18,paddingHorizontal:12,borderWidth:1,borderColor:colors.border,borderRadius:12,backgroundColor:colors.surface}}>
      <Ionicons name="search-outline" size={18} color={colors.mutedText}/><TextInput accessibilityLabel="Club book search" value={query} onChangeText={setQuery} onSubmitEditing={() => submitSearch.current?.()} returnKeyType="search" placeholder="Search title or author" placeholderTextColor={colors.mutedText} style={{...copy,flex:1,padding:13,fontFamily:'Inter_400Regular'}}/>
      {query?<Pressable accessibilityRole="button" accessibilityLabel="Clear club book search" onPress={()=>setQuery('')} style={{padding:8}}><Ionicons name="close-circle" size={18} color={colors.mutedText}/></Pressable>:null}
    </View>
    {busy?<ActivityIndicator color={colors.gold} style={{margin:16}}/>:error||term.length >= 2&&!results.length?<Text style={{...copy,color:colors.mutedText,margin:18}}>{error||'No books found. Try another title or author.'}</Text>:null}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:18}}>{results.map(book=><Pressable key={book.id} accessibilityRole="button" accessibilityLabel={`Choose club book: ${book.volumeInfo.title}`} onPress={()=>onChoose(book)} style={{flexDirection:'row',alignItems:'center',gap:13,paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.border}}>
      <BookCoverImage googleBookId={book.id} isbn={getNovoriSearchBookIsbn(book)} existingCoverUrl={getNovoriSearchBookCover(book)} style={{width:49,height:74,borderRadius:5}}/>
      <View style={{flex:1}}><Text style={copy}>{displayBookTitle(book.volumeInfo.title ?? '')}</Text><Text style={{...copy,fontFamily:'Inter_400Regular',fontSize:11,color:colors.mutedText,marginTop:5}}>{book.volumeInfo.authors?.join(', ')}</Text><BookSearchRatings book={book}/></View>
    </Pressable>)}</ScrollView>
    </SafeAreaView>
    </SafeAreaProvider>
  </Modal>;
}
