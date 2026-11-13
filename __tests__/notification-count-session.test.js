jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getSession:jest.fn(),getUser:jest.fn()},from:jest.fn()}}));
const {supabase}=require('../src/lib/supabase');const {getUnreadNotificationCount}=require('../src/lib/notifications');
beforeEach(()=>jest.clearAllMocks());
function setup(){const result={count:4,error:null},q={select:jest.fn(()=>q),eq:jest.fn(()=>q),is:jest.fn(()=>q),abortSignal:jest.fn(()=>q),then:(resolve)=>Promise.resolve(result).then(resolve)};supabase.from.mockReturnValue(q);return q;}
it('uses cached session identity instead of an auth/user fetch for every event',async()=>{
 const q=setup();supabase.auth.getSession.mockResolvedValue({data:{session:{user:{id:'a'}}},error:null});const c=new AbortController();expect(await getUnreadNotificationCount({signal:c.signal,expectedUserId:'a'})).toBe(4);
 expect(supabase.auth.getUser).not.toHaveBeenCalled();expect(q.abortSignal).toHaveBeenCalledWith(c.signal);expect(q.eq).toHaveBeenCalledWith('recipient_id','a');
});
it('does not expose a previous accounts count after an account switch during the read',async()=>{
 setup();supabase.auth.getSession.mockResolvedValueOnce({data:{session:{user:{id:'a'}}}}).mockResolvedValueOnce({data:{session:{user:{id:'b'}}}});
 expect(await getUnreadNotificationCount({expectedUserId:'a'})).toBe(0);
});
it('does not start a read for an already aborted request or mismatched account',async()=>{
 supabase.auth.getSession.mockResolvedValue({data:{session:{user:{id:'b'}}}});expect(await getUnreadNotificationCount({expectedUserId:'a'})).toBe(0);expect(supabase.from).not.toHaveBeenCalled();
});
