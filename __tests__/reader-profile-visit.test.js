import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {useReaderProfileVisit} from '../src/lib/use-reader-profile-visit';
let mockFocus,mockBlur,mockAuth;
const mockUnsubscribe=jest.fn();
jest.mock('expo-router',()=>({useFocusEffect:callback=>{mockFocus=callback;require('react').useEffect(()=>{mockBlur=callback();return()=>mockBlur?.();},[callback]);}}));
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{onAuthStateChange:callback=>{mockAuth=callback;return{data:{subscription:{unsubscribe:mockUnsubscribe}}};}}}}));
function Harness({id='reader',actions}){useReaderProfileVisit(id,actions);return null;}
let view,actions,quiet;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.clearAllMocks();actions={load:jest.fn(),revalidate:jest.fn(),clear:jest.fn(),cancel:jest.fn(),hasProfile:jest.fn().mockReturnValue(true)};quiet=jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;quiet.mockRestore();});
async function mount(){await act(async()=>{view=renderer.create(<Harness actions={actions}/>);});}
async function blur(){await act(async()=>mockBlur());}
async function focus(){await act(async()=>{mockBlur=mockFocus();});}
async function auth(event,userId){await act(async()=>{mockAuth(event,userId?{user:{id:userId}}:null);await Promise.resolve();});}
test('returning from a book revalidates without clearing the page, restarting sections or cancelling in-flight work',async()=>{
 await mount();expect(actions.load).toHaveBeenCalledTimes(1);
 await blur();expect(actions.cancel).not.toHaveBeenCalled();expect(actions.clear).not.toHaveBeenCalled();
 await focus();expect(actions.load).toHaveBeenCalledTimes(1);expect(actions.revalidate).toHaveBeenCalledTimes(1);expect(actions.clear).not.toHaveBeenCalled();
});
test('a failed or unfinished initial profile retries on return instead of keeping an empty screen',async()=>{
 actions.hasProfile.mockReturnValue(false);await mount();await blur();await focus();expect(actions.load).toHaveBeenCalledTimes(2);expect(actions.revalidate).not.toHaveBeenCalled();
});
test('leaving the navigation entry cancels its pending work',async()=>{
 await mount();await act(async()=>view.unmount());view=null;expect(actions.cancel).toHaveBeenCalledTimes(1);expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});
test('changing reader ID loads a fresh page and invalidates the previous entry',async()=>{
 await mount();await act(async()=>view.update(<Harness id="another" actions={actions}/>));expect(actions.load).toHaveBeenCalledTimes(2);expect(actions.cancel).toHaveBeenCalledTimes(1);
});
test('sign-out while viewing a book clears retained profile data, even before an initial auth event',async()=>{
 await mount();await blur();await auth('SIGNED_OUT',null);expect(actions.clear).toHaveBeenCalledTimes(1);expect(actions.cancel).toHaveBeenCalledTimes(1);expect(actions.load).toHaveBeenCalledTimes(1);
});
test('token refresh preserves the page; switching accounts clears and reloads',async()=>{
 await mount();await auth('INITIAL_SESSION','viewer-one');await auth('TOKEN_REFRESHED','viewer-one');expect(actions.clear).not.toHaveBeenCalled();expect(actions.load).toHaveBeenCalledTimes(1);
 await auth('SIGNED_IN','viewer-two');expect(actions.clear).toHaveBeenCalledTimes(1);expect(actions.load).toHaveBeenCalledTimes(2);
});
