import {useEffect} from 'react';
import {useLocalSearchParams} from 'expo-router';
import {useTutorial} from '../context/tutorial-context';
export default function TutorialLauncher(){
 const tour=useTutorial(),{welcome}=useLocalSearchParams<{welcome?:string}>(),start=tour?.start;
 useEffect(()=>{start?.(welcome==='1');},[start,welcome]);
 return null;
}
