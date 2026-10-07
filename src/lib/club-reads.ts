import { supabase } from './supabase';
import { parseClubRead,validateClubRead,type ClubRead,type ClubReadInput,type ClubReads } from './club-read';
export const CLUB_READS_PAGE_SIZE = 20;
export async function getClubReads(clubId: string,scope: 'all'|'upcoming'|'past' = 'all',offset = 0): Promise<ClubReads> {
  const {data,error} = await supabase.rpc('get_club_reads',{target_club_id:clubId,read_scope:scope,page_offset:offset,result_limit:CLUB_READS_PAGE_SIZE});
  if (error) throw error;
  const rows = (values: unknown[]) => (values??[]).map(parseClubRead).filter((row): row is ClubRead => Boolean(row));
  return {current:parseClubRead(data?.current),upcoming:rows(data?.upcoming),past:rows(data?.past),upcoming_more:Boolean(data?.upcoming_more),past_more:Boolean(data?.past_more)};
}
export async function getClubRead(readId: string): Promise<ClubRead> {
  const {data,error} = await supabase.rpc('get_club_read',{target_read_id:readId});
  if (error) throw error;const read=parseClubRead(data);if (!read) throw Error('This club read is unavailable.');return read;
}
export async function saveClubRead(clubId: string,input: ClubReadInput,read?: ClubRead,requestKey?: string) {
  const {data,error} = await supabase.rpc('save_club_read',{target_club_id:clubId,read_input:validateClubRead(input),target_read_id:read?.id??null,expected_updated_at:read?.updated_at??null,request_key:requestKey??null});
  if (error) throw error;if (typeof data!=='string') throw Error('Could not confirm the club read was saved.');return data;
}
export async function removeClubRead(read: ClubRead) {
  const {error} = await supabase.rpc('remove_club_read',{target_read_id:read.id,expected_updated_at:read.updated_at});if (error) throw error;
}
export function newClubReadRequestKey() { return `read-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
