import {useFocusEffect} from 'expo-router';
import {useCallback,useState} from 'react';
import {getExplicitLanguagePreference,setExplicitLanguagePreference} from '../lib/content-filter';

/** One preference read per profile surface, shared by all its post cards. */
export function useFeedLanguagePreference(){
 const [allowExplicitLanguage,setAllow]=useState(false);
 useFocusEffect(useCallback(()=>{
  let active=true;
  void getExplicitLanguagePreference().then(value=>{if(active)setAllow(value);}).catch(()=>{if(active)setAllow(false);});
  return ()=>{active=false;};
 },[]));
 const onAlwaysShow=useCallback(async()=>{setAllow(await setExplicitLanguagePreference(true));},[]);
 return {allowExplicitLanguage,onAlwaysShow};
}
