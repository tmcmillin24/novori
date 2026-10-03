import type { ClubEventBook } from './club-event';
export type ClubDiscussion = {
  id:string;club_id:string;post_id:string;read_id:string|null;created_by:string|null;
  kind:'discussion'|'poll';title:string;prompt:string;book:ClubEventBook|null;
  contains_spoilers:boolean;spoiler_label:string|null;options:string[];
  closed_at:string|null;voting_started_at:string|null;created_at:string;updated_at:string;
  vote_counts?:number[];viewer_choice?:number|null;viewer_is_member?:boolean;viewer_can_manage?:boolean;
};
export type ClubDiscussionInput=Pick<ClubDiscussion,'read_id'|'kind'|'title'|'prompt'|'contains_spoilers'|'spoiler_label'|'options'>;
export function parseClubDiscussion(value:unknown):ClubDiscussion|null {
  const row=(Array.isArray(value)?value[0]:value) as ClubDiscussion|null;
  return row&&typeof row.id==='string'&&typeof row.post_id==='string'&&typeof row.title==='string'&&['discussion','poll'].includes(row.kind)&&Array.isArray(row.options)?row:null;
}
export function validateClubDiscussion(input:ClubDiscussionInput):ClubDiscussionInput {
  if(!['discussion','poll'].includes(input.kind))throw Error('Choose a discussion or poll.');
  if(input.title.trim().length<3||input.title.trim().length>160)throw Error('Give your discussion or poll a title between 3 and 160 characters.');
  if(input.prompt.trim().length>3000)throw Error('Your discussion can be up to 3,000 characters.');
  if(input.kind==='discussion'&&!input.prompt.trim())throw Error('Add a question or thought to start the discussion.');
  const options=input.kind==='poll'?input.options.map(option=>option.trim()):[];
  if(input.kind==='poll'&&(options.length<2||options.length>6||options.some(option=>!option||option.length>140)||new Set(options.map(option=>option.toLowerCase())).size!==options.length))throw Error('Add 2–6 different poll choices, up to 140 characters each.');
  if(input.contains_spoilers&&(!input.spoiler_label?.trim()||input.spoiler_label.trim().length>80))throw Error('Add a spoiler limit, such as “Through chapter 5” or “Whole book”.');
  return {...input,title:input.title.trim(),prompt:input.prompt.trim(),options,read_id:input.read_id||null,spoiler_label:input.contains_spoilers?input.spoiler_label!.trim():null};
}
export function discussionRevealKey(d:ClubDiscussion){return `${d.id}:${d.updated_at}`;}
export function clubDiscussionPreview(d:ClubDiscussion){return d.contains_spoilers?'Spoiler-marked '+(d.kind==='poll'?'poll':'discussion'):d.title;}
