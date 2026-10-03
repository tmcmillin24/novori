import { supabase } from './supabase';
import { markPostMutation } from './feed';
import { parseClubDiscussion,validateClubDiscussion,type ClubDiscussion,type ClubDiscussionInput } from './club-discussion';
export const CLUB_DISCUSSIONS_PAGE_SIZE=20;
export async function getClubDiscussions(clubId:string,readId:string|null=null,scope:'all'|'discussion'|'poll'='all',offset=0){
  const {data,error}=await supabase.rpc('get_club_discussions',{target_club_id:clubId,target_read_id:readId,discussion_scope:scope,page_offset:offset,result_limit:CLUB_DISCUSSIONS_PAGE_SIZE});if(error)throw error;
  return (data??[]).map(parseClubDiscussion).filter((row:ClubDiscussion|null):row is ClubDiscussion=>Boolean(row));
}
export async function getClubDiscussion(id:string):Promise<ClubDiscussion>{const {data,error}=await supabase.rpc('get_club_discussion',{target_discussion_id:id});if(error)throw error;const row=parseClubDiscussion(data);if(!row)throw Error('This discussion is unavailable.');return row;}
export async function saveClubDiscussion(clubId:string,input:ClubDiscussionInput,discussion?:ClubDiscussion,requestKey?:string){
  const {data,error}=await supabase.rpc('save_club_discussion',{target_club_id:clubId,discussion_input:validateClubDiscussion(input),target_discussion_id:discussion?.id??null,expected_updated_at:discussion?.updated_at??null,request_key:requestKey??null});if(error)throw error;if(typeof data!=='string')throw Error('Could not confirm your discussion was saved.');markPostMutation();return data;
}
export async function voteClubPoll(id:string,choice:number|null){const {data,error}=await supabase.rpc('vote_club_poll',{target_discussion_id:id,choice_index:choice});if(error)throw error;const row=parseClubDiscussion(data);if(!row)throw Error('Could not confirm your vote.');return row;}
export async function closeClubPoll(id:string){const {error}=await supabase.rpc('close_club_poll',{target_discussion_id:id});if(error)throw error;markPostMutation();}
export function newClubDiscussionRequestKey(){return `discussion-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;}
