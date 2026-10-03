import { Ionicons } from '@expo/vector-icons';
import { useEffect,useState } from 'react';
import { Pressable,Text,View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
export default function ClubReadDateField({label,value,onChange}:{label:string;value:string|null;onChange:(day:string|null)=>void}) {
  const {colors}=useNovoriTheme();const [open,setOpen]=useState(false),[month,setMonth]=useState(()=>new Date());
  useEffect(()=>{if(value)setMonth(new Date(`${value}T12:00:00`));},[value]);
  const cells=[...Array(new Date(month.getFullYear(),month.getMonth(),1).getDay()).fill(null),...Array.from({length:new Date(month.getFullYear(),month.getMonth()+1,0).getDate()},(_,i)=>i+1)];while(cells.length%7)cells.push(null);
  const text={color:colors.secondaryText,fontFamily:'Inter_500Medium',fontSize:12};
  return <View style={{marginTop:12}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label.toLowerCase()}`} onPress={()=>setOpen(v=>!v)} style={{flex:1,flexDirection:'row',alignItems:'center',gap:8,minHeight:44}}><Ionicons name="calendar-outline" size={17} color={colors.gold}/><Text style={text}>{label}: {value?new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Optional'}</Text><Ionicons name={open?'chevron-up':'chevron-down'} size={14} color={colors.gold}/></Pressable>
    {value?<Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label.toLowerCase()}`} onPress={()=>{onChange(null);setOpen(false);}} style={{padding:8}}><Ionicons name="close-circle-outline" size={18} color={colors.mutedText}/></Pressable>:null}
  </View>{open?<View style={{backgroundColor:colors.elevated,padding:8,borderRadius:12}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Previous ${label.toLowerCase()} month`} onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} style={{padding:10}}><Ionicons name="chevron-back" size={18} color={colors.gold}/></Pressable>
      <Text style={text}>{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Next ${label.toLowerCase()} month`} onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} style={{padding:10}}><Ionicons name="chevron-forward" size={18} color={colors.gold}/></Pressable>
    </View>
    <View style={{flexDirection:'row'}}>{['S','M','T','W','T','F','S'].map((day,i)=><Text key={i} style={{...text,width:'14.2857%',textAlign:'center',paddingVertical:6,color:colors.mutedText}}>{day}</Text>)}</View>
    <View style={{flexDirection:'row',flexWrap:'wrap'}}>{cells.map((date,index)=>{const key=date?`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(date).padStart(2,'0')}`:'';return <Pressable key={index} disabled={!date} accessibilityRole="button" accessibilityLabel={date?`${label} ${key}`:undefined} onPress={()=>{onChange(key);setOpen(false);}} style={{width:'14.2857%',height:40,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:key===value?colors.gold:'transparent'}}><Text style={{...text,color:key===value?colors.background:colors.text}}>{date}</Text></Pressable>;})}</View>
  </View>:null}</View>;
}
