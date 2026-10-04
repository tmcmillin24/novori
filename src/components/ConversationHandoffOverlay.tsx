import {useSyncExternalStore} from 'react';
import {Platform,StyleSheet,View} from 'react-native';
import {FullWindowOverlay} from 'react-native-screens';
import {useNovoriTheme} from '../context/theme-context';
import {conversationHandoffCovered,getConversationHandoff,subscribeConversationHandoff} from '../lib/conversation-handoff';

export default function ConversationHandoffOverlay(){
  const handoff=useSyncExternalStore(subscribeConversationHandoff,getConversationHandoff,getConversationHandoff);
  const {colors}=useNovoriTheme();
  if(!handoff)return null;
  const cover=<View accessibilityLabel="Opening conversation" style={[StyleSheet.absoluteFill,{backgroundColor:colors.background,zIndex:1000,elevation:1000}]} onLayout={()=>conversationHandoffCovered(handoff)}/>;
  return Platform.OS==='ios'?<FullWindowOverlay>{cover}</FullWindowOverlay>:cover;
}
