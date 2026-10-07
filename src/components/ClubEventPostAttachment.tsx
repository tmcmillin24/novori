import { useRouter } from 'expo-router';
import ClubEventCard from './ClubEventCard';
import useEventClock from '../hooks/use-event-clock';
import type { ClubEvent } from '../lib/club-event';
export default function ClubEventPostAttachment({event}:{event:ClubEvent}) {
  const router = useRouter();const now = useEventClock(Date.parse(event.ends_at));
  return <ClubEventCard event={event} now={now} onOpen={()=>router.push({pathname:'/club-event/[id]',params:{id:event.id}})}/>;
}
