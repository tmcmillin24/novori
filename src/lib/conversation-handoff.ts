type Handoff = {postId:string;commentId:string;onCovered:()=>void;covered:boolean};
let current:Handoff|null=null;
const listeners=new Set<()=>void>();
function emit(){listeners.forEach(listener=>listener());}
export const subscribeConversationHandoff=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
export const getConversationHandoff=()=>current;

/** Mount an opaque window cover before touching the sheet underneath it. */
export function beginConversationHandoff(postId:string,commentId:string,onCovered:()=>void){
  current={postId,commentId,onCovered,covered:false};emit();
}
export function cancelConversationHandoff(postId:string,commentId:string){
  if(current?.postId===postId && current.commentId===commentId){current=null;emit();}
}
export function conversationHandoffCovered(handoff:Handoff){
  if(current!==handoff || handoff.covered)return;
  handoff.covered=true;
  try{handoff.onCovered();}catch(error){current=null;emit();throw error;}
}
/** Release only after the matching destination has a native layout. */
export function conversationDestinationLaidOut(postId:string,commentId:string){
  const handoff=current;
  if(!handoff || handoff.postId!==postId || handoff.commentId!==commentId)return;
  requestAnimationFrame(()=>{
    if(current===handoff){current=null;emit();}
  });
}
