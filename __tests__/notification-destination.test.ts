jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
import { getNotificationDestination } from '../src/lib/notification-destination';
import type { NovoriNotification } from '../src/lib/notifications';
const notification = (overrides: Partial<NovoriNotification>): NovoriNotification => ({ id:'id',recipient_id:'reader',actor_id:null,type:'system',title:'Update',body:null,actor_display_name:null,actor_username:null,actor_avatar_url:null,entity_type:null,entity_id:null,image_url:null,metadata:{},read_at:null,created_at:'2026-11-13',...overrides });
it('opens the correct recap period from the same inbox route',()=>{
 expect(getNotificationDestination(notification({entity_type:'reading_reminder',metadata:{reading_reminder_kind:'weekly_recap',reference_date:'2026-11-08'}}))).toEqual({pathname:'/reading-recaps',params:{mode:'week',referenceDate:'2026-11-08'}});
});
it('preserves club event and post/comment destinations',()=>{
 expect(getNotificationDestination(notification({type:'club_event',metadata:{event_id:'event'}}))).toEqual({pathname:'/club-event/[id]',params:{id:'event'}});
 expect(getNotificationDestination(notification({type:'reply',metadata:{post_id:'post',comment_id:'comment'}}))).toEqual({pathname:'/post/[id]',params:{id:'post',commentId:'comment'}});
});
it('routes followers and book updates without trusting arbitrary external URLs',()=>{
 expect(getNotificationDestination(notification({type:'follow',entity_id:'reader'}))).toEqual({pathname:'/reader/[id]',params:{id:'reader'}});
 expect(getNotificationDestination(notification({metadata:{google_book_id:'nv_123'}}))).toEqual({pathname:'/book/[id]',params:{id:'nv_123',source:'notifications'}});
 expect(getNotificationDestination(notification({metadata:{url:'https://untrusted.example'}}))).toBeNull();
});
