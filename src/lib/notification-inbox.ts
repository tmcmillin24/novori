import type {NovoriNotification} from './notifications';
import {getReadingReminderKind} from './reading-reminders';
export type InboxFilter='all'|'clubs'|'replies'|'reading';
export const INBOX_FILTERS:{key:InboxFilter;label:string}[]=[{key:'all',label:'All'},{key:'clubs',label:'Clubs'},{key:'replies',label:'Replies'},{key:'reading',label:'Reading'}];
export function isClubNotification(item:NovoriNotification){return item.type.startsWith('club_')||item.entity_type==='club'||typeof item.metadata?.club_id==='string';}
export function isReadingNotification(item:NovoriNotification){return item.type==='reading_started'||item.type==='reading_finished'||Boolean(getReadingReminderKind(item));}
export function filterInbox(items:NovoriNotification[],filter:InboxFilter){return items.filter(item=>filter==='all'||(filter==='clubs'&&isClubNotification(item))||(filter==='replies'&&['comment','reply'].includes(item.type))||(filter==='reading'&&isReadingNotification(item)));}
export function notificationSectionLabel(timestamp:string,now=new Date()){
  const today=new Date(now);today.setHours(0,0,0,0);const yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
  const time=Date.parse(timestamp);return time>=today.getTime()?'Today':time>=yesterday.getTime()?'Yesterday':'Earlier';
}
export function notificationCategoryLabel(item:NovoriNotification){return isClubNotification(item)?'Clubs':isReadingNotification(item)?'Reading':['comment','reply'].includes(item.type)?'Replies':item.type.startsWith('follow')?'Readers':'Activity';}
