import type {NovoriNotification} from './notifications';

export function getClubNotificationDestination(item:NovoriNotification){
  const eventId=item.metadata?.event_id;
  if(item.type==='club_event'&&typeof eventId==='string'&&eventId)return {pathname:'/club-event/[id]' as const,params:{id:eventId}};
  if(item.entity_type==='club'&&item.entity_id){
    if(item.metadata?.activity_kind==='welcome')return {pathname:'/club/[id]' as const,params:{id:item.entity_id,guide:'1'}};
    if(item.metadata?.activity_kind==='current_read')return {pathname:'/club/[id]' as const,params:{id:item.entity_id,tab:'books'}};
  }
  return null;
}
