import {useEffect,useRef,useState} from 'react';
import {useRootNavigationState,useRouter} from 'expo-router';
import {supabase} from '../lib/supabase';
import {acceptedCurrentTerms} from '../lib/legal-documents';
import {needsTutorial} from '../lib/tutorial';

export default function TutorialGate() {
 const router=useRouter(),navigation=useRootNavigationState();
 const [reader,setReader]=useState<{id:string;user_metadata?:Record<string,unknown>}|null>(null);
 const launched=useRef<string|null>(null);
 useEffect(()=>{
  let active=true,sequence=0;
  const initial=sequence;
  void supabase.auth.getSession().then(({data})=>{if(active&&sequence===initial)setReader(data.session?.user??null);}).catch(()=>{});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
   sequence++;
   if(active){setReader(session?.user??null);if(!session)launched.current=null;}
  });
  return ()=>{active=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  // Wait until normal account routing and legal acceptance have completed.
  const route=navigation?.routes[navigation.index??0];
  if(route?.name!=='(tabs)'||!reader||launched.current===reader.id||!acceptedCurrentTerms(reader.user_metadata)||!needsTutorial(reader.user_metadata))return;
  launched.current=reader.id;
  router.push({pathname:'/tutorial',params:{welcome:'1'}});
 },[navigation,reader,router]);
 return null;
}
