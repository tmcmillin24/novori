export type CommentSheetSnap='partial'|'full';
/** Runs on the UI thread as well as in the gesture regression tests. */
export function resolveCommentSheetSnap(snap:CommentSheetSnap,height:number,partial:number,full:number,dy:number,velocityY:number):CommentSheetSnap|'dismiss'{
  'worklet';
  const midpoint=partial+(full-partial)*0.52;
  if(snap==='full'){
    if(height<=partial*0.68 || dy>220 || velocityY>1050)return 'dismiss';
    return height<=midpoint || dy>56 || velocityY>420?'partial':'full';
  }
  if(height<=partial*0.68 || dy>118 || velocityY>920)return 'dismiss';
  return height>=midpoint || dy < -42 || velocityY < -380?'full':'partial';
}

/** Snap points must fit the current app window, including smaller iPad windows. */
export function getCommentSheetBounds(windowHeight:number,topInset:number){
  const full=Math.max(0,windowHeight-Math.max(0,topInset));
  return {full,partial:Math.min(full,Math.max(360,Math.round(windowHeight*0.82)))};
}
