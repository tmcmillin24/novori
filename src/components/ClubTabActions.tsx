import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable,Text,View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';

type Props = { clubId: string; tab: 'posts'|'events'|'books'; isMember: boolean; canManage: boolean };
export default function ClubTabActions({clubId,tab,isMember,canManage}: Props) {
  const router=useRouter(),{colors}=useNovoriTheme();
  if(!isMember)return null;
  const action=tab==='posts'
    ? {label:'Post in Club',accessibilityLabel:'Post in Club',icon:'create-outline' as const,route:{pathname:'/create-post' as const,params:{clubId}}}
    : tab==='events'
    ? {label:'Create an event',accessibilityLabel:'Create club event',icon:'calendar-outline' as const,route:{pathname:'/create-club-event' as const,params:{clubId}}}
    : {label:'Add book',accessibilityLabel:'Add club read',icon:'book-outline' as const,route:{pathname:'/edit-club-read' as const,params:{clubId,status:'upcoming'}}};
  return <View accessibilityLabel="Club tab actions" style={{flexDirection:'row',alignItems:'center',gap:8,minHeight:46,marginBottom:14}}>
    {tab==='posts'||canManage?<Pressable accessibilityRole="button" accessibilityLabel={action.accessibilityLabel} onPress={()=>router.push(action.route)} style={({pressed})=>({flex:1,minHeight:46,paddingHorizontal:10,paddingVertical:12,borderRadius:13,backgroundColor:colors.gold,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,opacity:pressed ? .75 : 1})}>
      <Ionicons name={action.icon} size={18} color={colors.background}/><Text style={{color:colors.background,fontFamily:'Inter_700Bold',fontSize:12}}>{action.label}</Text>
    </Pressable>:<Text style={{flex:1,color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:11,lineHeight:18}}>{tab==='events'?'Club owners and admins organize events.':'Club owners and admins manage shared reads.'}</Text>}
    {canManage?<Pressable accessibilityRole="button" accessibilityLabel="Create club announcement" onPress={()=>router.push({pathname:'/create-post',params:{clubId,announcement:'1'}})} style={({pressed})=>({width:112,minHeight:46,paddingHorizontal:9,paddingVertical:12,borderRadius:13,borderWidth:1,borderColor:`${colors.gold}45`,backgroundColor:`${colors.gold}12`,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,opacity:pressed ? .75 : 1})}>
      <Ionicons name="megaphone-outline" size={16} color={colors.gold}/><Text style={{color:colors.gold,fontFamily:'Inter_600SemiBold',fontSize:11}}>Announce</Text>
    </Pressable>:null}
  </View>;
}
