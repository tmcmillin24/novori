import {Keyboard} from 'react-native';

type Destination={pathname:'/post/[id]/conversation';params:{id:string;threadId:string;commentId:string}};
/** Every conversation entry uses the same route; sheet entries bypass normal dismissal. */
export function openCommentConversation(push:(destination:Destination)=>void,postId:string,commentId:string,sheet?:{stopMotion:()=>void;suspend:(navigate:()=>void)=>void}){
  const navigate=()=>{Keyboard.dismiss();push({pathname:'/post/[id]/conversation',params:{id:postId,threadId:commentId,commentId}});};
  if(sheet){sheet.stopMotion();sheet.suspend(navigate);}else navigate();
}
