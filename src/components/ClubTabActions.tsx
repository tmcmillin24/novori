import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable,Text } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';

type Props = { clubId: string; tab: 'posts'|'events'|'books'; isMember: boolean; canManage: boolean };
export default function ClubTabActions({clubId,tab,isMember,canManage}: Props) {
  const router=useRouter(),{colors}=useNovoriTheme();
  if (!isMember || (tab !== 'posts' && !canManage)) return null;
  const action=tab==='posts'
    ? {label:'New post',accessibilityLabel:'Post in Club',icon:'create-outline' as const,route:{pathname:'/create-post' as const,params:{clubId}}}
    : tab==='events'
    ? {label:'Create an event',accessibilityLabel:'Create club event',icon:'calendar-outline' as const,route:{pathname:'/create-club-event' as const,params:{clubId}}}
    : {label:'Add book',accessibilityLabel:'Add club read',icon:'book-outline' as const,route:{pathname:'/edit-club-read' as const,params:{clubId,status:'upcoming'}}};
  return <Pressable accessibilityRole="button" accessibilityLabel={action.accessibilityLabel} onPress={() => router.push(action.route)}
    style={({ pressed }) => ({ alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: 10, marginBottom: 6,
      flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? .75 : 1 })}>
    <Ionicons name={action.icon} size={17} color={colors.gold}/>
    <Text style={{ color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{action.label}</Text>
  </Pressable>;
}
