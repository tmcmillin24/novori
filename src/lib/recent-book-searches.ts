import AsyncStorage from '@react-native-async-storage/async-storage';
import {useEffect,useRef,useState,useCallback} from 'react';
const KEY='novori:recent-book-searches:v1';
export function normalizeRecentBookSearches(values:unknown):string[]{
 if(!Array.isArray(values))return [];
 const seen=new Set<string>();return values.flatMap(value=>{
  if(typeof value!=='string')return [];
  const term=value.trim().replace(/\s+/g,' ');const key=term.toLowerCase();
  if(term.length<2||term.length>160||seen.has(key))return [];seen.add(key);return [term];
 }).slice(0,10);
}
export function useRecentBookSearches(){
 const [searches,setSearches]=useState<string[]>([]);
 const values=useRef<string[]>([]);const queue=useRef<Promise<void>>(Promise.resolve());
 useEffect(()=>{
  let active=true;
  queue.current=queue.current.then(async()=>{
   try{values.current=normalizeRecentBookSearches(JSON.parse(await AsyncStorage.getItem(KEY)??'[]'));}catch{values.current=[];}
   if(active)setSearches(values.current);
  });return()=>{active=false;};
 },[]);
 const change=useCallback((update:(old:string[])=>string[])=>{
  queue.current=queue.current.then(async()=>{
   values.current=normalizeRecentBookSearches(update(values.current));setSearches(values.current);
   try{await AsyncStorage.setItem(KEY,JSON.stringify(values.current));}catch{/* Local storage failure does not block search. */}
  });
 },[]);
 const remember=useCallback((term:string)=>change(old=>[term,...old]),[change]);
 const remove=useCallback((term:string)=>change(old=>old.filter(value=>value.toLowerCase()!==term.toLowerCase())),[change]);
 const clear=useCallback(()=>change(()=>[]),[change]);
 return{searches,remember,remove,clear};
}
