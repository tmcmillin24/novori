import {useEffect,useRef,useCallback} from 'react';
import {useFocusEffect} from 'expo-router';
import {supabase} from './supabase';
type Actions={load:()=>void;revalidate:()=>void;hasProfile:()=>boolean;clear:()=>void;cancel:()=>void};
/** Retain one mounted navigation entry, never a shared/persistent profile cache. */
export function useReaderProfileVisit(readerId:string,actions:Actions){
 const latest=useRef(actions);latest.current=actions;
 const visited=useRef<string|null>(null),focused=useRef(false);
 useEffect(()=>{
  let active=true;let account:string|null|undefined;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
   if(!active)return;
   const next=session?.user.id??null;
   if(account===undefined&&_event!=='SIGNED_OUT'){account=next;return;}
   if(account===next&&_event!=='SIGNED_OUT')return;
   account=next;visited.current=null;latest.current.cancel();latest.current.clear();
   // Do not start Supabase reads inside its synchronous auth callback.
   if(next)queueMicrotask(()=>{if(active&&focused.current&&visited.current!==readerId){visited.current=readerId;latest.current.load();}});
  });
  return()=>{active=false;visited.current=null;subscription.unsubscribe();latest.current.cancel();};
 },[readerId]);
 useFocusEffect(useCallback(()=>{
  focused.current=true;
  if(visited.current===readerId&&latest.current.hasProfile())latest.current.revalidate();
  else{visited.current=readerId;latest.current.load();}
  // Pushing a book keeps the profile's ScrollView and section requests alive.
  return()=>{focused.current=false;};
 },[readerId]));
}
