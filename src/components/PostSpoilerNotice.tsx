import {useState,type ReactNode} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useNovoriTheme} from '../context/theme-context';
import type {FeedPost} from '../lib/feed';
export function usePostSpoiler(post:FeedPost|null) {
 const [revealed,setRevealed]=useState('');
 const key=post ? `${post.id}:${post.updated_at}` : '';
 return {hidden:Boolean(post?.contains_spoilers && revealed!==key),reveal:()=>setRevealed(key)};
}
export function PostSpoilerNotice({onReveal}:{onReveal:()=>void}) {
 const {colors}=useNovoriTheme();
 return <View style={{paddingVertical:14}}><Ionicons name="eye-off-outline" color={colors.gold} size={22}/><Text style={{color:colors.text,fontFamily:'Inter_600SemiBold',marginTop:8}}>This post contains spoilers</Text><Pressable accessibilityRole="button" accessibilityLabel="Reveal post spoilers" onPress={event=>{event.stopPropagation();onReveal();}} style={{paddingVertical:12}}><Text style={{color:colors.gold,fontFamily:'Inter_600SemiBold'}}>Reveal post</Text></Pressable></View>;
}

export function PostSpoilerContent({post,children}:{post:FeedPost;children:ReactNode}) {
 const {hidden,reveal}=usePostSpoiler(post);
 return hidden ? <PostSpoilerNotice onReveal={reveal}/> : <>{children}</>;
}
