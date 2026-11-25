import {Switch,Text,View} from 'react-native';
import {useNovoriTheme} from '../context/theme-context';
export default function SpoilerToggle({value,onChange,disabled=false}:{value:boolean;onChange:(value:boolean)=>void;disabled?:boolean}) {
 const {colors}=useNovoriTheme();
 return <View style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:8,paddingVertical:12}}>
  <Text style={{flexShrink:1,textAlign:'right',color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:14}}>Contains spoilers</Text>
  <Switch accessibilityLabel="Contains spoilers" value={value} onValueChange={onChange} disabled={disabled} trackColor={{true:colors.gold}} />
 </View>;
}
