import { Ionicons } from '@expo/vector-icons';
import { Pressable,Text,View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { formatClubReadDates,type ClubRead } from '../lib/club-read';
import BookCoverImage from './BookCoverImage';
export default function ClubReadCard({read,onOpen,onOptions}:{read:ClubRead;onOpen?:()=>void;onOptions?:()=>void}) {
  const {colors}=useNovoriTheme(),current=read.status==='current',dates=formatClubReadDates(read);
  return <View style={{backgroundColor:colors.surface,borderWidth:1,borderColor:current?`${colors.gold}55`:colors.border,borderRadius:18,overflow:'hidden',width:current?'100%':236}}>
    <View style={{height:3,backgroundColor:current?colors.gold:`${colors.gold}40`}}/>
    <View style={{padding:15}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12}}><Text style={{color:colors.gold,fontFamily:'Inter_700Bold',fontSize:10,letterSpacing:.7}}>{current?'READING TOGETHER':read.status==='upcoming'?'UP NEXT':'PAST CLUB READ'}</Text>
      {onOptions?<Pressable accessibilityRole="button" accessibilityLabel={`Options for club read: ${read.book.title}`} onPress={onOptions} hitSlop={8} style={{padding:4}}><Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedText}/></Pressable>:null}</View>
      <Pressable disabled={!onOpen} accessibilityRole={onOpen?'button':undefined} accessibilityLabel={onOpen?`Open club book: ${read.book.title}`:undefined} onPress={onOpen} style={{flexDirection:current?'row':'column',gap:14,alignItems:current?'center':'flex-start'}}>
        <BookCoverImage googleBookId={read.book.googleBookId} isbn={read.book.isbn} existingCoverUrl={read.book.coverUrl} style={{width:current?82:65,height:current?123:98,borderRadius:6,backgroundColor:colors.elevated}}/>
        <View style={current?{flex:1}:undefined}><Text numberOfLines={current?3:2} style={{color:colors.text,fontFamily:'PlayfairDisplay_700Bold',fontSize:current?22:19,lineHeight:current?28:24}}>{read.book.title}</Text><Text numberOfLines={2} style={{color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:11,lineHeight:17,marginTop:5}}>{read.book.authors.join(', ')}</Text><Text style={{color:colors.gold,fontFamily:'Inter_600SemiBold',fontSize:10,marginTop:10}}>View book</Text></View>
      </Pressable>
      {dates?<Text style={{color:colors.secondaryText,fontFamily:'Inter_500Medium',fontSize:11,lineHeight:17,marginTop:13}}>{dates}</Text>:null}
      {read.note?<Text numberOfLines={current?undefined:3} style={{color:colors.secondaryText,fontFamily:'Inter_400Regular',fontSize:12,lineHeight:19,marginTop:10}}>{read.note}</Text>:null}
    </View>
  </View>;
}
