const fs=require('fs');const vm=require('vm');const ts=require('typescript');
function harness({allowed=true,canAskAgain=true,physical=true,user='reader',stored=true,rpcError=null,afterToken,nativePresent=true,onToken}={}){
 let current=user;const calls=[];let permission={granted:allowed,canAskAgain};
 const storage=new Map(stored?[['novori:push-install:v1',JSON.stringify({id:'install',secret:'a'.repeat(64)})]]:[]);
 const native={getPermissionsAsync:async()=>permission,requestPermissionsAsync:async()=>{calls.push('prompt');return permission={granted:true,canAskAgain:true};},getExpoPushTokenAsync:async()=>{calls.push('token');if(onToken)onToken();if(afterToken)current=afterToken;return {data:'ExpoPushToken[test]'};},IosAuthorizationStatus:{PROVISIONAL:3}};
 const supabase={auth:{getSession:async()=>({data:{session:current?{user:{id:current}}:null}})},rpc:async(name,args)=>{calls.push({name,args});return {error:rpcError};}};
 const exports={};const code=ts.transpileModule(fs.readFileSync('src/lib/push-notifications.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,console,require:name=>{
  if(name==='@react-native-async-storage/async-storage')return {__esModule:true,default:{getItem:async k=>storage.get(k)||null,setItem:async(k,v)=>{storage.set(k,v);}}};
  if(name==='expo-constants')return {__esModule:true,default:{easConfig:{projectId:'project'}}};
  if(name==='expo-modules-core')return {requireOptionalNativeModule:()=>nativePresent?{}:null};
  if(name==='expo-device')return {isDevice:physical};
  if(name==='react-native')return {Platform:{OS:'ios'}};
  if(name==='./supabase')return {supabase};
  if(name==='expo-notifications')return native;
  if(name==='expo-crypto')return {randomUUID:()=> '00000000-0000-4000-8000-000000000000'};
  throw Error(name);
 }});
 return {api:exports,calls,storage,setUser:v=>current=v};
}
it('registers an allowed installation without prompting or storing its push token',async()=>{
 const h=harness();await h.api.syncPushDevice();expect(h.api.getPushStatus()).toBe('enabled');
 expect(h.calls).toContainEqual(expect.objectContaining({name:'novori_register_push_device'}));expect(h.calls).not.toContain('prompt');
 expect([...h.storage.values()].join('')).not.toContain('ExpoPushToken');
});
it('does not ask permission until the user enables notifications',async()=>{
 const h=harness({allowed:false});await h.api.syncPushDevice();expect(h.api.getPushStatus()).toBe('off');expect(h.calls).not.toContain('prompt');
 await h.api.syncPushDevice(true);expect(h.calls).toContain('prompt');expect(h.api.getPushStatus()).toBe('enabled');
});
it('unregisters denied installations and does not reprompt an OS denial',async()=>{
 const h=harness({allowed:false,canAskAgain:false});await h.api.syncPushDevice(true);expect(h.api.getPushStatus()).toBe('denied');
 expect(h.calls).toContainEqual(expect.objectContaining({name:'novori_unregister_push_device'}));expect(h.calls).not.toContain('prompt');expect(h.calls).not.toContain('token');
});
it('removes the installation binding after signout using its proof',async()=>{
 const h=harness({user:null});await h.api.syncPushDevice();expect(h.calls).toContainEqual(expect.objectContaining({name:'novori_unregister_push_device'}));
 expect(h.calls).not.toContain('token');
});
it('does not register a token for an account that changed during the native request',async()=>{
 const h=harness({afterToken:'other'});await h.api.syncPushDevice();expect(h.calls.some(c=>c.name==='novori_register_push_device')).toBe(false);
 expect(h.calls.some(c=>c.name==='novori_unregister_push_device')).toBe(true);
});
it('keeps the app usable on an unsupported device and does not call its backend',async()=>{
 const h=harness({physical:false});await h.api.syncPushDevice();expect(h.api.getPushStatus()).toBe('unavailable');expect(h.calls).toEqual([]);
});
it('reports backend failures and allows a later retry rather than false success',async()=>{
 const h=harness({rpcError:{message:'offline'}});await expect(h.api.syncPushDevice()).rejects.toBeDefined();expect(h.api.getPushStatus()).toBe('error');
});

it('checks native capability before importing the throwing notification entrypoint',async()=>{
 const h=harness({nativePresent:false});await h.api.syncPushDevice();expect(h.api.getPushStatus()).toBe('unavailable');expect(h.calls).toEqual([]);
});
it('marks registration in progress while the native token request can emit a token event',async()=>{
 let active=false;const h=harness({onToken:()=>{active=h.api.isPushSyncInProgress();}});
 await h.api.syncPushDevice();expect(active).toBe(true);expect(h.api.isPushSyncInProgress()).toBe(false);
});
