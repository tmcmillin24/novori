import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {Platform} from 'react-native';
import {useSheetAction} from '../src/lib/use-sheet-action';
jest.mock('react-native',()=>({Platform:{OS:'ios'}}));
let view,next;
function Harness({open}){next=useSheetAction(open);return null;}
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;Platform.OS='ios';});
afterEach(async()=>{await act(async()=>view?.unmount());});
async function mount(){await act(async()=>{view=renderer.create(<Harness open/>);});}
test('iOS opens the next sheet only after native dismissal, exactly once',async()=>{
 await mount();const action=jest.fn();next.queue(action);
 await act(async()=>view.update(<Harness open={false}/>));expect(action).not.toHaveBeenCalled();
 await act(async()=>next.afterDismiss());expect(action).toHaveBeenCalledTimes(1);
 await act(async()=>next.afterDismiss());expect(action).toHaveBeenCalledTimes(1);
});
test('cancel or swipe dismissal does not open another sheet',async()=>{
 await mount();await act(async()=>view.update(<Harness open={false}/>));
 expect(()=>next.afterDismiss()).not.toThrow();
});
test('Android dispatches after the source becomes hidden without needing onDismiss',async()=>{
 Platform.OS='android';await mount();const action=jest.fn();next.queue(action);
 expect(action).not.toHaveBeenCalled();await act(async()=>view.update(<Harness open={false}/>));
 expect(action).toHaveBeenCalledTimes(1);next.afterDismiss();expect(action).toHaveBeenCalledTimes(1);
});
