import { supabase } from './supabase';

export type ClubMemberExperience = {
  notifications_enabled: boolean;
  global_notifications_enabled: boolean;
  welcome_seen_at: string | null;
  current_read_id: string | null;
  current_read_title: string | null;
};

async function experienceRpc(name:string,args:Record<string,unknown>):Promise<ClubMemberExperience> {
  const {data,error}=await supabase.rpc(name,args);
  if(error)throw error;
  if(!data||typeof data.notifications_enabled!=='boolean'||typeof data.global_notifications_enabled!=='boolean')throw Error('Could not load your club preferences.');
  return data as ClubMemberExperience;
}
export function getClubMemberExperience(clubId:string){return experienceRpc('get_club_member_experience',{target_club_id:clubId});}
export function setClubNotificationsEnabled(clubId:string,enabled:boolean){return experienceRpc('set_club_notifications_enabled',{target_club_id:clubId,enabled});}
export function dismissClubWelcome(clubId:string){return experienceRpc('dismiss_club_welcome',{target_club_id:clubId});}
