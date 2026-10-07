import {Ionicons} from '@expo/vector-icons';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNovoriTheme} from '../context/theme-context';

export default function ReplyComposerContext({name,body,hideBody=false,onCancel}:{name:string;body:string;hideBody?:boolean;onCancel?:()=>void}) {
  const {colors}=useNovoriTheme();
  return <View style={styles.context}>
    <View style={styles.heading}>
      <Text numberOfLines={1} style={[styles.label,{color:colors.mutedText}]}>Replying to {name}</Text>
      {onCancel?<Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={onCancel} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.mutedText}/></Pressable>:null}
    </View>
    <Text numberOfLines={2} style={[styles.quote,{color:colors.mutedText,borderLeftColor:colors.border}]}>{hideBody?'Comment hidden by your language preference.':body}</Text>
  </View>;
}

const styles=StyleSheet.create({
  context:{paddingHorizontal:4,paddingBottom:8,gap:4},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  label:{flex:1,fontFamily:'Inter_600SemiBold',fontSize:12},
  quote:{fontFamily:'Inter_400Regular',fontSize:12,lineHeight:17,borderLeftWidth:2,paddingLeft:8},
});
