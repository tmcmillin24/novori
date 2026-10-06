import {useEffect,useRef,type ReactNode} from 'react';
import {Modal,Platform,StyleSheet,View} from 'react-native';
import {FullWindowOverlay} from 'react-native-screens';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

type Props={visible:boolean;children:ReactNode;onShow:()=>void;onDismiss:()=>void;onRequestClose:()=>void};
/** iOS sheets stay in the app window, without presenting a modal view controller. */
export default function CommentsWindowOverlay({visible,children,onShow,onDismiss,onRequestClose}:Props){
  const wasVisible=useRef(false);
  const shown=useRef(false);
  const callbacks=useRef({onShow,onDismiss});
  callbacks.current={onShow,onDismiss};
  useEffect(()=>{
    if(Platform.OS!=='ios')return;
    if(!visible && wasVisible.current){shown.current=false;callbacks.current.onDismiss();}
    wasVisible.current=visible;
  },[visible]);
  if(Platform.OS!=='ios')return <Modal supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} visible={visible} transparent animationType="none" onShow={onShow} onDismiss={onDismiss} onRequestClose={onRequestClose}><GestureHandlerRootView style={{flex:1}}>{children}</GestureHandlerRootView></Modal>;
  if(!visible)return null;
  return <FullWindowOverlay unstable_accessibilityContainerViewIsModal>
    <View style={StyleSheet.absoluteFill} onLayout={()=>{if(!shown.current){shown.current=true;callbacks.current.onShow();}}}><GestureHandlerRootView style={{flex:1}}>{children}</GestureHandlerRootView></View>
  </FullWindowOverlay>;
}
