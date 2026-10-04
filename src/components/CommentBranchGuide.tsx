import {useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {useNovoriTheme} from '../context/theme-context';

export default function CommentBranchGuide(){
  const {colors}=useNovoriTheme();
  const [height,setHeight]=useState(0);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.rail} onLayout={event=>setHeight(event.nativeEvent.layout.height)}>
    {Array.from({length:Math.ceil(height/9)},(_,index)=><View key={index} style={[styles.dot,{top:index*9,backgroundColor:colors.gold}]}/>)}
  </View>;
}
const styles=StyleSheet.create({
  rail:{position:'absolute',left:0,top:18,bottom:12,width:2,overflow:'hidden'},
  dot:{position:'absolute',left:0,width:2,height:2,borderRadius:1,opacity:0.5},
});
