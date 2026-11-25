import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable,Text } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';

type Props = { clubId: string; clubName?: string; onPost?: () => void; tab: 'posts'|'events'|'books'; isMember: boolean; canManage: boolean; compact?: boolean };
export default function ClubTabActions({clubId,clubName,onPost,tab,isMember,canManage,compact = false}: Props) {
  const router=useRouter(),{colors}=useNovoriTheme();
  if (!isMember || (tab !== 'posts' && !canManage)) return null;
  const action=tab==='posts'
    ? {label:'New post',accessibilityLabel:'New post',icon:'create-outline' as const,route:{pathname:'/create-post' as const,params:{clubId,clubName}}}
    : tab==='events'
    ? {label:'Create an event',accessibilityLabel:'Create club event',icon:'calendar-outline' as const,route:{pathname:'/create-club-event' as const,params:{clubId}}}
    : {label:'Add book',accessibilityLabel:'Add club read',icon:'book-outline' as const,route:{pathname:'/edit-club-read' as const,params:{clubId,status:'upcoming'}}};
  return <Pressable accessibilityRole="button" accessibilityLabel={action.accessibilityLabel} onPress={() => tab === 'posts' && onPost ? onPost() : router.push(action.route)}
    style={({ pressed }) => compact ? ({ width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold, opacity: pressed ? .75 : 1 }) : ({ alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: 10, marginBottom: 6,
      flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? .75 : 1 })}>
    <Ionicons name={action.icon} size={19} color={compact ? colors.background : colors.gold}/>
    {!compact ? <Text style={{ color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{action.label}</Text> : null}
  </Pressable>;
}
