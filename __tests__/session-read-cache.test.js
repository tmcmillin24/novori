import {supabase} from '../src/lib/supabase';
import {getSessionReadScope,sessionRead,invalidateSessionReads,isTransientReadError} from '../src/lib/session-read-cache';
let mockAuthChange;
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getSession:jest.fn(),getUser:jest.fn(),onAuthStateChange:jest.fn(callback=>{mockAuthChange=callback;return {data:{subscription:{unsubscribe:jest.fn()}}};})},rpc:jest.fn(),from:jest.fn()}}));
const session=(id='reader',token='token')=>({user:{id},access_token:token});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const rpcResponse=response=>Object.assign(Promise.resolve(response),{abortSignal:jest.fn(()=>Promise.resolve(response))});
let scope;
beforeEach(async()=>{jest.useFakeTimers().setSystemTime(new Date('2026-10-04T16:00:00Z'));invalidateSessionReads();jest.clearAllMocks();supabase.auth.getSession.mockResolvedValue({data:{session:session()},error:null});scope=(await getSessionReadScope()).key;});
afterEach(()=>{invalidateSessionReads();jest.useRealTimers();});
test('concurrent and recently repeated thread reads share one request; expired and forced reads are fresh',async()=>{
 const waiting=deferred();const read=jest.fn(()=>waiting.promise);const first=sessionRead(scope,'comments:post',read);const second=sessionRead(scope,'comments:post',read);expect(first).toBe(second);await Promise.resolve();expect(read).toHaveBeenCalledTimes(1);waiting.resolve(['comment']);await first;
 expect(await sessionRead(scope,'comments:post',read)).toEqual(['comment']);expect(read).toHaveBeenCalledTimes(1);
 await sessionRead(scope,'comments:post',read,{force:true});expect(read).toHaveBeenCalledTimes(2);await jest.advanceTimersByTimeAsync(20001);await sessionRead(scope,'comments:post',read);expect(read).toHaveBeenCalledTimes(3);
});
test('failed and invalidated reads never populate the cache or prevent retry',async()=>{
 const read=jest.fn().mockRejectedValueOnce(new Error('fetch failed')).mockResolvedValueOnce('fresh');await expect(sessionRead(scope,'post:1',read)).rejects.toThrow('fetch failed');expect(await sessionRead(scope,'post:1',read)).toBe('fresh');
 const old=deferred();const request=sessionRead(scope,'comments:1',()=>old.promise);await Promise.resolve();invalidateSessionReads('comments:');old.resolve('old');await request;const newRead=jest.fn(async()=> 'new');expect(await sessionRead(scope,'comments:1',newRead)).toBe('new');expect(newRead).toHaveBeenCalledTimes(1);
});
test('switching accounts and signing out drop private cached data, including late responses',async()=>{
 const pending=deferred();const old=sessionRead(scope,'post:private',()=>pending.promise);await Promise.resolve();supabase.auth.getSession.mockResolvedValue({data:{session:session('other','other-token')}});const other=(await getSessionReadScope()).key;pending.resolve('private data');await old;
 const read=jest.fn(async()=> 'other data');expect(await sessionRead(other,'post:private',read)).toBe('other data');expect(read).toHaveBeenCalledTimes(1);
 mockAuthChange('SIGNED_OUT',null);supabase.auth.getSession.mockResolvedValue({data:{session:session('other','other-token')}});await getSessionReadScope();await sessionRead(other,'post:private',read);expect(read).toHaveBeenCalledTimes(2);
});
test('slow reads abort at the deadline and can be retried',async()=>{
 let signal;const request=sessionRead(scope,'comments:slow',s=>{signal=s;return new Promise(()=>{});});const rejection=expect(request).rejects.toMatchObject({code:'READ_TIMEOUT'});await jest.advanceTimersByTimeAsync(8000);await rejection;expect(signal.aborted).toBe(true);expect(await sessionRead(scope,'comments:slow',async()=> 'retry')).toBe('retry');
});
test('the native connection-lost error is classified as transient while permission errors are not',()=>{
 expect(isTransientReadError({code:'',message:'Error: fetch failed: UnexpectedException: The network connection was lost. (at ExpoModulesCore/Promise.swift:56)'})).toBe(true);expect(isTransientReadError({code:'42501',message:'Account unavailable'})).toBe(false);
});
test('comment reads use local session identity, dedupe RPCs, and preserve server authorization errors',async()=>{
 const {getPostComments}=require('../src/lib/comments');supabase.rpc.mockReturnValue(rpcResponse({data:[{id:'comment',author_id:'reader',body:'A comment'}],error:null}));
 await Promise.all([getPostComments('post'),getPostComments('post')]);expect(supabase.auth.getUser).not.toHaveBeenCalled();expect(supabase.rpc).toHaveBeenCalledTimes(1);expect(supabase.rpc).toHaveBeenCalledWith('get_post_comments',{target_post_id:'post',result_limit:500});
 invalidateSessionReads();supabase.rpc.mockReturnValue(rpcResponse({data:null,error:{code:'42501',message:'Account unavailable'}}));await expect(getPostComments('post')).rejects.toMatchObject({code:'42501'});
});
test('language preferences are deduped per login, updated preferences invalidate them, and signed-out reads fail closed',async()=>{
 const {getExplicitLanguagePreference,setExplicitLanguagePreference}=require('../src/lib/content-filter');supabase.rpc.mockImplementation(()=>rpcResponse({data:true,error:null}));expect(await getExplicitLanguagePreference()).toBe(true);expect(await getExplicitLanguagePreference()).toBe(true);expect(supabase.rpc).toHaveBeenCalledTimes(1);
 await setExplicitLanguagePreference(false);await getExplicitLanguagePreference();expect(supabase.rpc).toHaveBeenCalledTimes(3);supabase.auth.getSession.mockResolvedValue({data:{session:null},error:null});expect(await getExplicitLanguagePreference()).toBe(false);expect(supabase.rpc).toHaveBeenCalledTimes(3);
});

test('post detail caching preserves media hydration and never makes a remote user check',async()=>{
 const {getPostDetail}=require('../src/lib/feed');const post={id:'post',author_id:'reader',body:'A post'};supabase.rpc.mockReturnValue(rpcResponse({data:[post],error:null}));const select={in:jest.fn(async()=>({data:[{id:'post',post_image_url:'photo.jpg'}],error:null}))};supabase.from.mockReturnValue({select:jest.fn(()=>select)});
 expect(await getPostDetail('post')).toMatchObject({post_image_url:'photo.jpg'});expect(await getPostDetail('post')).toMatchObject({post_image_url:'photo.jpg'});expect(supabase.auth.getUser).not.toHaveBeenCalled();expect(supabase.rpc).toHaveBeenCalledTimes(1);expect(select.in).toHaveBeenCalledTimes(1);
 await getPostDetail('post',{force:true});expect(supabase.rpc).toHaveBeenCalledTimes(2);
});
test('confirmed edits, votes, and blocks invalidate previously cached comments',async()=>{
 const {getPostComments,updatePostComment,toggleCommentVote}=require('../src/lib/comments');const {blockReader}=require('../src/lib/social');supabase.rpc.mockImplementation(name=>rpcResponse({data:name==='toggle_comment_vote'?{viewer_vote:1,vote_score:1}:[{id:'comment',author_id:'reader',body:'A comment'}],error:null}));
 await getPostComments('post');await updatePostComment('comment','Edited');await getPostComments('post');await toggleCommentVote('comment',1);await getPostComments('post');await blockReader('other');await getPostComments('post');expect(supabase.rpc.mock.calls.filter(call=>call[0]==='get_post_comments')).toHaveLength(4);
});

test('a late preference read cannot override a newer successfully saved language setting',async()=>{
 const {getExplicitLanguagePreference,setExplicitLanguagePreference}=require('../src/lib/content-filter');const old=deferred();let reads=0;supabase.rpc.mockImplementation(name=>name==='get_explicit_language_preference'&&++reads===1?Object.assign(old.promise,{abortSignal:()=>old.promise}):rpcResponse({data:false,error:null}));
 const loading=getExplicitLanguagePreference();await Promise.resolve();await Promise.resolve();await setExplicitLanguagePreference(false);old.resolve({data:true,error:null});expect(await loading).toBe(false);
});
