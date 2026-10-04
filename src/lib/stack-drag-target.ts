/** Share discrete drop targets between the UI gesture and the stack editor. */
export function resolveStackDragTarget(startIndex:number,translationY:number,rowCount:number){
  'worklet';
  const raw=startIndex+translationY/72;
  const index=Math.max(0,Math.min(rowCount-1,Math.round(raw)));
  const fraction=raw-Math.floor(raw);
  const edge:'top'|'bottom'|null=translationY===0?null:translationY>0?(fraction<0.5?'top':'bottom'):(fraction>0.5?'bottom':'top');
  return {index,edge};
}
