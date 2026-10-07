import {getAccountEntryRoute} from '../src/lib/account-entry';
import {supabase} from '../src/lib/supabase';
import {getAccountDeletionStatus,getStoredDeletionStatus} from '../src/lib/account-deletion';
import {signOutCurrentDevice} from '../src/lib/sign-out';
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:jest.fn()}}}));
jest.mock('../src/lib/account-deletion',()=>({getAccountDeletionStatus:jest.fn(),getStoredDeletionStatus:jest.fn()}));
jest.mock('../src/lib/sign-out',()=>({signOutCurrentDevice:jest.fn()}));
beforeEach(()=>{jest.clearAllMocks();supabase.auth.getUser.mockResolvedValue({data:{user:{id:'reader'}},error:null});getStoredDeletionStatus.mockResolvedValue(null);getAccountDeletionStatus.mockResolvedValue({state:'active'});signOutCurrentDevice.mockResolvedValue();});
test('a deleted JWT goes to sign-in before requesting any profile/activity RPC',async()=>{supabase.auth.getUser.mockResolvedValue({data:{user:null},error:{code:'user_not_found',message:'User from sub claim in JWT does not exist'}});expect(await getAccountEntryRoute()).toBe('/auth');expect(signOutCurrentDevice).toHaveBeenCalled();expect(getAccountDeletionStatus).not.toHaveBeenCalled();});
test('a remotely scheduled account enters recovery instead of daily check-in/feed',async()=>{getAccountDeletionStatus.mockResolvedValue({state:'pending'});expect(await getAccountEntryRoute()).toBe('/delete-account');expect(signOutCurrentDevice).not.toHaveBeenCalled();});
test('a locally verified pending request stays restricted when offline',async()=>{getStoredDeletionStatus.mockResolvedValue({state:'pending'});expect(await getAccountEntryRoute()).toBe('/delete-account');expect(getAccountDeletionStatus).not.toHaveBeenCalled();});
test('a transient auth network failure never signs out an existing account',async()=>{supabase.auth.getUser.mockResolvedValue({data:{user:null},error:new Error('Network unavailable')});await expect(getAccountEntryRoute()).rejects.toThrow('Network unavailable');expect(signOutCurrentDevice).not.toHaveBeenCalled();});
test('normal accounts and installations awaiting deletion SQL still enter the app',async()=>{expect(await getAccountEntryRoute()).toBe(null);getAccountDeletionStatus.mockRejectedValue({code:'PGRST202'});expect(await getAccountEntryRoute()).toBe(null);});

 test('a banned session signs out before any normal app request',async()=>{
 supabase.auth.getUser.mockResolvedValue({data:{user:null},error:{code:'user_banned',message:'User is banned'}});
 expect(await getAccountEntryRoute()).toBe('/auth?notice=restricted');expect(signOutCurrentDevice).toHaveBeenCalled();expect(getAccountDeletionStatus).not.toHaveBeenCalled();
 });
