const fs=require('fs'),vm=require('vm'),ts=require('typescript'),path=require('path');
function load(file,requireFn=()=>{throw Error('No runtime imports expected');}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/'+file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:requireFn,Error});return exports;}
const route=load('club-notification-route.ts');
test('event alerts go to the actual event even when the linked post is in metadata',()=>{
 expect(route.getClubNotificationDestination({type:'club_event',metadata:{event_id:'event-1',post_id:'post-1'},entity_type:'club',entity_id:'club-1'})).toEqual({pathname:'/club-event/[id]',params:{id:'event-1'}});
});
test('welcome and shared-read notifications open the right club guide or books tab',()=>{
 expect(route.getClubNotificationDestination({type:'club_member',metadata:{activity_kind:'welcome'},entity_type:'club',entity_id:'club-1'})).toEqual({pathname:'/club/[id]',params:{id:'club-1',guide:'1'}});
 expect(route.getClubNotificationDestination({type:'club_post',metadata:{activity_kind:'current_read',read_id:'read-1'},entity_type:'club',entity_id:'club-1'})).toEqual({pathname:'/club/[id]',params:{id:'club-1',tab:'books'}});
});
test('ordinary posts, comments, invitations and malformed event ids retain existing routes',()=>{
 for(const type of ['club_post','comment','club_invite','reply'])expect(route.getClubNotificationDestination({type,metadata:{post_id:'post-1'},entity_type:'club',entity_id:'club-1'})).toBeNull();
 expect(route.getClubNotificationDestination({type:'club_event',metadata:{event_id:42},entity_type:'club',entity_id:'club-1'})).toBeNull();
});
test('member preferences use one RPC with no provider or feed calls and return confirmed state',async()=>{
 const calls=[],pref={notifications_enabled:true,global_notifications_enabled:false,welcome_seen_at:null,current_read_id:'read-1',current_read_title:'Stored shared read'};
 const supabase={rpc:async(name,args)=>{calls.push({name,args});return {data:{...pref,notifications_enabled:args.enabled??true}};}};
 const api=load('club-member-experience.ts',name=>{if(name!=='./supabase')throw Error('Unexpected dependency '+name);return {supabase};});
 expect(await api.getClubMemberExperience('club-1')).toEqual(pref);expect(await api.setClubNotificationsEnabled('club-1',false)).toEqual({...pref,notifications_enabled:false});await api.dismissClubWelcome('club-1');
 expect(calls).toEqual([{name:'get_club_member_experience',args:{target_club_id:'club-1'}},{name:'set_club_notifications_enabled',args:{target_club_id:'club-1',enabled:false}},{name:'dismiss_club_welcome',args:{target_club_id:'club-1'}}]);
});
test('permission/network failures and unconfirmed preference responses are surfaced',async()=>{
 const api=load('club-member-experience.ts',()=>({supabase:{rpc:async()=>({error:new Error('Join this club.')})}}));await expect(api.getClubMemberExperience('club-1')).rejects.toThrow('Join this club.');
 const malformed=load('club-member-experience.ts',()=>({supabase:{rpc:async()=>({data:{notifications_enabled:true}})}}));await expect(malformed.setClubNotificationsEnabled('club-1',false)).rejects.toThrow('Could not load');
});
