import {Keyboard,type View} from 'react-native';
import {beginConversationHandoff,cancelConversationHandoff} from './conversation-handoff';

type Destination={pathname:'/post/[id]/conversation';params:{id:string;threadId:string;commentId:string}};
/** Every conversation entry uses the same route; sheet entries bypass normal dismissal. */
export function openCommentConversation(push:(destination:Destination)=>void,postId:string,commentId:string,sheet?:{stopMotion:()=>void;suspend:(navigate:()=>void)=>void}){
  const navigate=()=>{
    try{Keyboard.dismiss();push({pathname:'/post/[id]/conversation',params:{id:postId,threadId:commentId,commentId}});}
    catch(error){cancelConversationHandoff(postId,commentId);throw error;}
  };
  if(sheet){beginConversationHandoff(postId,commentId,()=>{sheet.stopMotion();sheet.suspend(navigate);});}else navigate();
}

/** Hide before cancellation/unmount can publish a shorter sheet layout. */
export function hideCommentSheetForNavigation(view:Pick<View,'setNativeProps'>|null,stopMotion:()=>void){
  view?.setNativeProps({style:{opacity:0}});
  stopMotion();
}
