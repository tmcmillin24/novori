import {useState,type ReactNode} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {FeedPost} from '../lib/feed';
export function usePostSpoiler(post:FeedPost|null) {
 const [revealed,setRevealed]=useState('');
 const key=post ? `${post.id}:${post.updated_at}` : '';
 return {hidden:Boolean(post?.contains_spoilers && revealed!==key),reveal:()=>setRevealed(key)};
}
export function PostSpoilerNotice({onReveal}:{onReveal:()=>void}) {
 return (
  <View style={{backgroundColor:'#484846',borderColor:'#575754',borderWidth:1,borderRadius:14,paddingHorizontal:16,paddingTop:16,paddingBottom:6,marginVertical:10}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
    <Ionicons name="eye-off-outline" color="#FFFFFF" size={18}/>
    <Text style={{color:'#FFFFFF',fontFamily:'Inter_600SemiBold',fontSize:14,flex:1}}>This post contains spoilers</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Reveal post spoilers" onPress={event=>{event.stopPropagation();onReveal();}} style={({pressed})=>({minHeight:44,justifyContent:'center',alignSelf:'stretch',alignItems:'center',opacity:pressed ? .65 : 1})}>
    <Text style={{color:'#FFFFFF',fontFamily:'Inter_600SemiBold',fontSize:13}}>Reveal spoilers</Text>
   </Pressable>
  </View>
 );
}

export function PostSpoilerContent({post,children}:{post:FeedPost;children:ReactNode}) {
 const {hidden,reveal}=usePostSpoiler(post);
 return hidden ? <PostSpoilerNotice onReveal={reveal}/> : <>{children}</>;
}
