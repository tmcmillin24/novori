import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {Platform} from 'react-native';
import {useReportConfirmation} from '../src/lib/use-report-confirmation';
jest.mock('react-native',()=>({Platform:{OS:'ios'}}));
let view,confirmation;
function Harness({open}){confirmation=useReportConfirmation(open);return null;}
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;Platform.OS='ios';});
afterEach(async()=>{await act(async()=>view?.unmount());});
async function mount(){await act(async()=>{view=renderer.create(<Harness open/>);});}
test('iOS report success waits for native dismissal and acknowledges once',async()=>{
 await mount();confirmation.queue();await act(async()=>view.update(<Harness open={false}/>));
 expect(confirmation.visible).toBe(false);
 await act(async()=>confirmation.afterDismiss());expect(confirmation.visible).toBe(true);
 await act(async()=>confirmation.dismiss());expect(confirmation.visible).toBe(false);
 await act(async()=>confirmation.afterDismiss());expect(confirmation.visible).toBe(false);
});
test('canceling a report does not announce success',async()=>{
 await mount();await act(async()=>view.update(<Harness open={false}/>));
 await act(async()=>confirmation.afterDismiss());expect(confirmation.visible).toBe(false);
});
test('Android completes success when the source closes without an iOS callback',async()=>{
 Platform.OS='android';await mount();confirmation.queue();await act(async()=>view.update(<Harness open={false}/>));expect(confirmation.visible).toBe(true);
});
