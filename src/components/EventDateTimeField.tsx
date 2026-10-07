import { Ionicons } from '@expo/vector-icons';
import { useEffect,useState } from 'react';
import { Pressable,Text,TextInput,View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { localClubEventFields } from '../lib/club-event';
export type EventTimeFields = ReturnType<typeof localClubEventFields>;
export default function EventDateTimeField({label,value,onChange}:{label:string;value:EventTimeFields;onChange:(value:EventTimeFields)=>void}) {
  const {colors} = useNovoriTheme();const [expanded,setExpanded] = useState(false);
  const [month,setMonth] = useState(()=>new Date(Number(value.day.slice(0,4)),Number(value.day.slice(5,7))-1,1));
  useEffect(()=>{setMonth(new Date(Number(value.day.slice(0,4)),Number(value.day.slice(5,7))-1,1));},[value.day]);
  const inputStyle = {color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:14,backgroundColor:colors.elevated,borderRadius:9,padding:10,minWidth:44,textAlign:'center' as const};
  const copyStyle = {color:colors.secondaryText,fontFamily:'Inter_500Medium',fontSize:12};
  const day = new Date(Number(value.day.slice(0,4)),Number(value.day.slice(5,7))-1,Number(value.day.slice(8,10)));
  const cells = [...Array(month.getDay()).fill(null),...Array.from({length:new Date(month.getFullYear(),month.getMonth()+1,0).getDate()},(_,i)=>i+1)];
  while(cells.length%7)cells.push(null);
  return <View style={{marginTop:13}}><Text style={{...copyStyle,color:colors.gold,fontSize:10,marginBottom:7}}>{label.toUpperCase()}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label.toLowerCase()} date`} onPress={()=>setExpanded(v=>!v)} style={{flexDirection:'row',alignItems:'center',gap:8,minHeight:40}}>
      <Ionicons name="calendar-outline" size={17} color={colors.gold}/><Text style={copyStyle}>{day.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</Text><Ionicons name={expanded?'chevron-up':'chevron-down'} size={14} color={colors.gold}/>
    </Pressable>
    {expanded ? <View style={{marginVertical:8,backgroundColor:colors.elevated,borderRadius:12,padding:8}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Previous ${label.toLowerCase()} month`} onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} style={{padding:10}}><Ionicons name="chevron-back" size={18} color={colors.gold}/></Pressable>
        <Text style={copyStyle}>{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Next ${label.toLowerCase()} month`} onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} style={{padding:10}}><Ionicons name="chevron-forward" size={18} color={colors.gold}/></Pressable>
      </View>
      <View style={{flexDirection:'row'}}>{['S','M','T','W','T','F','S'].map((name,i)=><Text key={i} style={{...copyStyle,width:'14.2857%',textAlign:'center',paddingVertical:6,color:colors.mutedText}}>{name}</Text>)}</View>
      <View style={{flexDirection:'row',flexWrap:'wrap'}}>{cells.map((date,index)=>{
        const key=date?`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(date).padStart(2,'0')}`:'';
        return <Pressable key={index} disabled={!date} accessibilityRole="button" accessibilityLabel={date?`${label} date ${key}`:undefined}
          onPress={()=>{onChange({...value,day:key});setExpanded(false);}} style={{width:'14.2857%',height:40,alignItems:'center',justifyContent:'center',borderRadius:9,backgroundColor:key===value.day?colors.gold:'transparent'}}>
          <Text style={{...copyStyle,color:key===value.day?colors.background:colors.text}}>{date}</Text>
        </Pressable>;
      })}</View>
    </View>:null}
    <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
      <TextInput accessibilityLabel={`${label} hour`} value={value.hour} onChangeText={hour=>onChange({...value,hour})} keyboardType="number-pad" maxLength={2} style={inputStyle}/><Text style={copyStyle}>:</Text>
      <TextInput accessibilityLabel={`${label} minute`} value={value.minute} onChangeText={minute=>onChange({...value,minute})} keyboardType="number-pad" maxLength={2} style={inputStyle}/>
      {[false,true].map(pm=><Pressable key={String(pm)} accessibilityRole="button" accessibilityLabel={`${label} ${pm?'PM':'AM'}`} accessibilityState={{selected:pm===value.pm}} onPress={()=>onChange({...value,pm})} style={{padding:11,borderRadius:9,backgroundColor:pm===value.pm?colors.gold:colors.elevated}}><Text style={{...copyStyle,color:pm===value.pm?colors.background:colors.text}}>{pm?'PM':'AM'}</Text></Pressable>)}
    </View>
  </View>;
}
