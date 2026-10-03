import {filterInbox,notificationSectionLabel,notificationCategoryLabel} from '../src/lib/notification-inbox';
jest.mock('../src/lib/supabase',()=>({supabase:{}}));
const item=(id,type,extra={})=>({id,type,entity_type:null,metadata:{},...extra});
test('inbox filters overlap club replies but separate reading and ordinary reactions',()=>{
 const items=[item('club','club_post'),item('club-reply','reply',{metadata:{club_id:'club-1'}}),item('reply','comment'),item('read','reading_finished'),item('reminder','system',{entity_type:'reading_reminder',metadata:{reading_reminder_kind:'daily_checkin'}}),item('reaction','post_vote')];
 expect(filterInbox(items,'all')).toEqual(items);
 expect(filterInbox(items,'clubs').map(n=>n.id)).toEqual(['club','club-reply']);
 expect(filterInbox(items,'replies').map(n=>n.id)).toEqual(['club-reply','reply']);
 expect(filterInbox(items,'reading').map(n=>n.id)).toEqual(['read','reminder']);
 expect(items.map(notificationCategoryLabel)).toEqual(['Clubs','Clubs','Replies','Reading','Reading','Activity']);
});
test('date groups use calendar boundaries including month and year changes',()=>{
 const now=new Date(2027,0,1,12);const iso=(y,m,d,h)=>new Date(y,m,d,h).toISOString();
 expect(notificationSectionLabel(iso(2027,0,1,0),now)).toBe('Today');
 expect(notificationSectionLabel(iso(2026,11,31,23),now)).toBe('Yesterday');
 expect(notificationSectionLabel(iso(2026,11,30,23),now)).toBe('Earlier');
});
