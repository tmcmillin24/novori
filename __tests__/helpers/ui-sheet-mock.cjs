const React=require('react');
const {Modal,View}=require('react-native');
exports.useUiSheetMotion=({visible,busy=false,onDismiss})=>{
 const latest=React.useRef({visible,busy,onDismiss});latest.current={visible,busy,onDismiss};
 const closing=React.useRef(false),timer=React.useRef(null);
 React.useEffect(()=>()=>clearTimeout(timer.current),[]);
 React.useEffect(()=>{if(!visible){clearTimeout(timer.current);closing.current=false;}},[visible]);
 const start=(action,completed=false)=>{if(closing.current || (latest.current.busy&&!completed))return;closing.current=true;latest.current.onDismiss();closing.current=false;if(typeof action==='function')action();};
 return {closing,close:action=>start(action),closeAfterAction:()=>start(undefined,true),closeAfterActionWithCallback:action=>start(action,true),onShow:()=>{},onLayout:()=>{},gesture:{},sheetStyle:{},backdropStyle:{}};
};
exports.UiSheetModal=({motion,...props})=>React.createElement(Modal,{...props,animationType:'none',onShow:motion.onShow});
exports.UiSheetSurface=({motion,...props})=>React.createElement('AnimatedView',props);
exports.UiSheetBackdrop=({motion,...props})=>React.createElement('AnimatedView',props);
