import { supabase } from './supabase';
import { markPostMutation } from './feed';
import { parseClubEvent, validateClubEvent, type ClubEvent, type ClubEventInput, type ClubEventRsvp } from './club-event';

export const CLUB_EVENTS_PAGE_SIZE = 20;
export async function getClubEvents(clubId: string,scope: 'upcoming'|'past' = 'upcoming',offset = 0): Promise<ClubEvent[]> {
  const { data,error } = await supabase.rpc('get_club_events',{target_club_id:clubId,event_scope:scope,page_offset:offset,result_limit:CLUB_EVENTS_PAGE_SIZE});
  if (error) throw error;
  return (data ?? []).map(parseClubEvent).filter((event: ClubEvent | null): event is ClubEvent => Boolean(event));
}
export async function getClubEvent(eventId: string): Promise<ClubEvent> {
  const {data,error} = await supabase.rpc('get_club_event',{target_event_id:eventId});
  if (error) throw error;
  const event = parseClubEvent(data);if (!event) throw Error('This event is unavailable.');return event;
}
export async function saveClubEvent(clubId: string,input: ClubEventInput,event?: ClubEvent,requestKey?: string) {
  const normalized = validateClubEvent(input);
  const {data,error} = await supabase.rpc('save_club_event',{target_club_id:clubId,event_input:normalized,target_event_id:event?.id ?? null,expected_updated_at:event?.updated_at ?? null,request_key:requestKey ?? null});
  if (error) throw error;
  if (typeof data !== 'string') throw Error('Could not confirm that the event was saved.');
  markPostMutation();return data;
}
export async function cancelClubEvent(eventId: string) {
  const {error} = await supabase.rpc('cancel_club_event',{target_event_id:eventId});if (error) throw error;markPostMutation();
}
export async function setClubEventRsvp(eventId: string,status: ClubEventRsvp | null): Promise<ClubEvent> {
  const {data,error} = await supabase.rpc('set_club_event_rsvp',{target_event_id:eventId,rsvp_status:status});
  if (error) throw error;const event = parseClubEvent(data);if (!event) throw Error('Could not confirm your RSVP.');return event;
}
export function newClubEventRequestKey() {
  return `event-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
