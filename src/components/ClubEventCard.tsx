import { displayBookTitle } from '../lib/book-title';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable,StyleSheet,Text,View } from 'react-native';
import BookCoverImage from './BookCoverImage';
import { useNovoriTheme } from '../context/theme-context';
import { formatClubEventTime,type ClubEvent } from '../lib/club-event';

type Props = { event: ClubEvent; onOpen?: () => void; next?: boolean; detail?: boolean; now?: number };
export default function ClubEventCard({event,onOpen,next=false,detail=false,now=Date.now()}: Props) {
  const {colors} = useNovoriTheme();
  const styles = useMemo(() => StyleSheet.create({
    card:{backgroundColor:colors.surface,borderWidth:1,borderColor:`${colors.gold}40`,borderRadius:18,overflow:'hidden',marginBottom:12},
    accent:{height:3,backgroundColor:colors.gold},body:{padding:14},label:{color:colors.gold,fontFamily:'Inter_700Bold',fontSize:10,letterSpacing:.7,marginBottom:7},
    title:{color:colors.text,fontFamily:'PlayfairDisplay_700Bold',fontSize:22,lineHeight:28,marginBottom:9},
    meta:{color:colors.secondaryText,fontFamily:'Inter_500Medium',fontSize:11,lineHeight:18},
    description:{color:colors.secondaryText,fontFamily:'Inter_400Regular',fontSize:13,lineHeight:20,marginTop:12},
    book:{flexDirection:'row',gap:11,alignItems:'center',marginTop:13},cover:{width:42,height:63,borderRadius:5,backgroundColor:colors.elevated},
    bookCopy:{flex:1},bookTitle:{color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:12},author:{color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:10,marginTop:4},
    footer:{flexDirection:'row',gap:5,alignItems:'center',marginTop:12},footerText:{color:colors.gold,fontFamily:'Inter_600SemiBold',fontSize:11},pressed:{opacity:.75},
  }),[colors]);
  const status = event.cancelled_at ? 'CANCELLED' : Date.parse(event.ends_at)<=now ? 'PAST EVENT' : Date.parse(event.starts_at)<=now ? 'HAPPENING NOW' : next ? 'NEXT EVENT' : 'CLUB EVENT';
  return <Pressable disabled={!onOpen} onPress={onOpen} accessibilityRole={onOpen?'button':undefined} accessibilityLabel={onOpen?`Open event: ${event.title}`:undefined} style={({pressed})=>[styles.card,pressed&&styles.pressed]}>
    <View style={styles.accent}/><View style={styles.body}><Text style={styles.label}>{status}</Text><Text style={styles.title}>{event.title}</Text>
      <Text style={styles.meta}>{formatClubEventTime(event)}</Text>
      <Text style={styles.meta}>{event.kind==='virtual'?'Virtual meeting':event.location}</Text>
      {detail&&event.description ? <Text style={styles.description}>{event.description}</Text>:null}
      {event.book ? <View style={styles.book}><BookCoverImage googleBookId={event.book.googleBookId} isbn={event.book.isbn} existingCoverUrl={event.book.coverUrl} style={styles.cover}/>
        <View style={styles.bookCopy}><Text style={styles.bookTitle} numberOfLines={detail?undefined:2}>{displayBookTitle(event.book.title ?? '')}</Text><Text style={styles.author} numberOfLines={2}>{event.book.authors.join(', ')}</Text></View></View>:null}
      {onOpen ? <View style={styles.footer}><Ionicons name="calendar-outline" size={14} color={colors.gold}/><Text style={styles.footerText}>View event</Text><Ionicons name="chevron-forward" size={13} color={colors.gold}/></View>:null}
    </View>
  </Pressable>;
}
