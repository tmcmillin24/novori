import {getReaderProfile,isReaderBlockedByViewer,getReaderPublicBooks,getReaderPublicOwnedBooks,getReaderPublicReviews,getReaderPublicClubs,getReaderProfilePosts} from './social';
import type {ReaderSocialProfile,PublicReaderBook,PublicReaderReview} from './social';
import {getMyClubs} from './clubs';
import type {ClubWithMembership} from './clubs';
import {getPublicBookStacks} from './book-stacks';
import type {BookStack} from './book-stacks';
import {getHomeFeed} from './feed';
import type {FeedPost} from './feed';
import {getLockedVerifiedCoverUrls} from './user-books';
import {sortProfileBooks} from './profile-book-order';
type Section='library'|'clubs'|'stacks'|'activity';
type Handlers={
 isCurrent:()=>boolean;
 ready:(profile:ReaderSocialProfile,blocked:boolean)=>void;
 library:(books:PublicReaderBook[],reviews:PublicReaderReview[])=>void;
 clubs:(clubs:ClubWithMembership[])=>void;
 managerClubs:(clubs:ClubWithMembership[])=>void;
 stacks:(stacks:BookStack[])=>void;
 activity:(posts:FeedPost[])=>void;
 error:(section:Section)=>void;
 settled:(section:Section)=>void;
};
/** One focused profile load. Nothing is retained across readers or accounts. */
export function createReaderProfileLoad(readerId:string,h:Handlers) {
 const started=Date.now();
 const timing=(label:string)=>{if(typeof __DEV__!=='undefined'&&__DEV__)console.info(`[Novori profile] ${label}: ${Date.now()-started}ms`);};
 let allowed=false;
 let viewerClubs:Promise<ClubWithMembership[]>=Promise.resolve([]);
 let activity:Promise<void>|null=null;
 async function section(name:Section,load:()=>Promise<void>) {
  try {await load();}catch(error){console.warn(`Could not load reader ${name}:`,error);if(h.isCurrent())h.error(name);}
  finally{if(h.isCurrent()){h.settled(name);timing(`${name} settled`);}}
 }
 const ready=Promise.all([getReaderProfile(readerId),isReaderBlockedByViewer(readerId)]).then(([profile,blocked])=>{
  if(!h.isCurrent())return;
  allowed=!blocked&&profile.can_view_content;
  h.ready(profile,blocked);timing('profile ready');
  if(!allowed){for(const name of ['library','clubs','stacks','activity'] as Section[])h.settled(name);return;}
  viewerClubs=getMyClubs().then(clubs=>{
   if(h.isCurrent())h.managerClubs(clubs.filter(club=>['owner','admin'].includes(club.membership_role??'')));
   return clubs;
  }).catch(error=>{console.warn('Could not load viewer clubs:',error);return [];});
 });
 const finished=ready.then(async()=>{
  if(!allowed||!h.isCurrent())return;
  await Promise.all([
   section('library',async()=>{
    const [books,owned,reviews]=await Promise.all([getReaderPublicBooks(readerId),getReaderPublicOwnedBooks(readerId).catch(error=>{console.warn('Could not load public owned books:',error);return [];}),getReaderPublicReviews(readerId)]);
    if(!h.isCurrent())return;
    const covers=await getLockedVerifiedCoverUrls([...books,...owned,...reviews].map(item=>item.google_book_id));
    const cover=<T extends {google_book_id:string;cover_url:string|null}>(item:T):T=>covers.has(item.google_book_id)?{...item,cover_url:covers.get(item.google_book_id)!}:item;
    const merged=Array.from(new Map([...books,...owned].map(item=>[item.id,cover(item)])).values());
    if(h.isCurrent())h.library(sortProfileBooks(merged),reviews.map(cover));
   }),
   section('clubs',async()=>{const clubs=await getReaderPublicClubs(readerId);if(h.isCurrent())h.clubs(clubs);}),
   section('stacks',async()=>{const stacks=await getPublicBookStacks(readerId);if(h.isCurrent())h.stacks(stacks);}),
  ]);
 });
 function loadActivity(){
  activity??=ready.then(async()=>{
   if(!allowed||!h.isCurrent())return;
   await section('activity',async()=>{
    const [postData,feed,clubs]=await Promise.all([getReaderProfilePosts(readerId),getHomeFeed(100),viewerClubs]);
    const clubIds=new Set(clubs.map(club=>club.id));
    const visible=postData.filter(post=>!post.club_id||clubIds.has(post.club_id));
    const shared=feed.filter(post=>post.author_id===readerId);
    const merged=Array.from(new Map([...visible,...shared].map(post=>[post.id,post])).values()).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
    if(h.isCurrent())h.activity(merged);
   });
  });
  return activity;
 }
 return {ready,finished,loadActivity};
}
