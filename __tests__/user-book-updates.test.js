import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {useUserBookUpdates} from '../src/lib/use-user-book-updates';
import {publishUserBookChange} from '../src/lib/user-book-events';
import {updateUserBookOwned} from '../src/lib/user-books';
jest.mock('../src/lib/canonical-book-covers',()=>({resolveCanonicalBookCover:jest.fn()}));
let mockAuth;
const mockUnsubscribe=jest.fn(), mockWrite=jest.fn();
jest.mock('../src/lib/supabase',()=>{
 const query={update:()=>query,eq:()=>query,select:()=>query,single:()=>mockWrite()};
 return {supabase:{from:()=>query,auth:{
  getUser:async()=>({data:{user:{id:'reader'}},error:null}),
  getSession:async()=>({data:{session:{user:{id:'reader'}}},error:null}),
  onAuthStateChange:callback=>{mockAuth=callback;return{data:{subscription:{unsubscribe:mockUnsubscribe}}};},
 }}};
});
function Page({id='book',onChange}){useUserBookUpdates(id,onChange);return null;}
let view;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.clearAllMocks();});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;});
test('an already mounted Discover page receives a confirmed Owned change immediately',async()=>{
 const changed=jest.fn();await act(async()=>{view=renderer.create(<Page onChange={changed}/>);});
 const row={google_book_id:'book',user_id:'reader',owned:true,status:null};
 mockWrite.mockResolvedValue({data:row,error:null});
 await act(async()=>updateUserBookOwned('book',true));expect(changed).toHaveBeenCalledWith(row);
});
test('other books/accounts and post-logout responses cannot change the page',async()=>{
 const changed=jest.fn();await act(async()=>{view=renderer.create(<Page onChange={changed}/>);});
 await act(async()=>{publishUserBookChange({google_book_id:'other',user_id:'reader'});publishUserBookChange({google_book_id:'book',user_id:'other-reader'});mockAuth('SIGNED_OUT',null);publishUserBookChange({google_book_id:'book',user_id:'reader',owned:true});});
 expect(changed).not.toHaveBeenCalled();
});
test('navigating to a different book stops applying changes to the previous book',async()=>{
 const changed=jest.fn();await act(async()=>{view=renderer.create(<Page onChange={changed}/>);});
 await act(async()=>{view.update(<Page id="next-book" onChange={changed}/>);});
 await act(async()=>publishUserBookChange({google_book_id:'book',user_id:'reader',owned:true}));expect(changed).not.toHaveBeenCalled();
 expect(mockUnsubscribe).toHaveBeenCalled();
});

test('failed ownership saves never update the mounted book page',async()=>{
 const changed=jest.fn();await act(async()=>{view=renderer.create(<Page onChange={changed}/>);});
 mockWrite.mockResolvedValue({data:null,error:new Error('offline')});
 await act(async()=>{await expect(updateUserBookOwned('book',true)).rejects.toThrow('offline');});
 expect(changed).not.toHaveBeenCalled();
});
