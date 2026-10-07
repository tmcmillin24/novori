import {Switch,Text,View} from 'react-native';
import {useNovoriTheme} from '../context/theme-context';
export default function SpoilerToggle({value,onChange,disabled=false}:{value:boolean;onChange:(value:boolean)=>void;disabled?:boolean}) {
 const {colors}=useNovoriTheme();
 return <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:16,paddingVertical:12}}>
  <View style={{flex:1}}><Text style={{color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:14}}>Contains spoilers</Text><Text style={{color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:12,marginTop:4}}>Readers tap to reveal your post.</Text></View>
  <Switch accessibilityLabel="Contains spoilers" value={value} onValueChange={onChange} disabled={disabled} trackColor={{true:colors.gold}} />
 </View>;
}
