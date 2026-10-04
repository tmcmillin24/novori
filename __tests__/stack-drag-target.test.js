import {resolveStackDragTarget} from '../src/lib/stack-drag-target';
test.each([[0,0,3,0,null],[0,20,3,0,'top'],[0,36,3,1,'bottom'],[1,-20,3,1,'bottom'],[1,-40,3,0,'top'],[0,-200,3,0,'top'],[2,200,3,2,'bottom']])('preserves drop target and edge for start %i and movement %i',(start,dy,count,index,edge)=>expect(resolveStackDragTarget(start,dy,count)).toEqual({index,edge}));
