import { supabase } from './supabase';
export const TUTORIAL_VERSION = '1';
export const TUTORIAL_STEPS = [
 {title:'Start at Home',anchor:'tab-home',path:'/',route:'/(tabs)',description:'This is your community’s home. Posts and clubs live here, ready whenever you return.'},
 {title:'Your Feed',anchor:'home-feed',path:'/',route:'/(tabs)',description:'See posts from readers you follow. Open a post or its comments to read, reply and join the conversation.'},
 {title:'Your clubs',anchor:'home-clubs',path:'/',route:'/(tabs)',description:'Switch to Clubs to find your communities. Open a club for posts, discussions, polls, events and reading picks.'},
 {title:'Discover something new',anchor:'tab-discover',path:'/discover',route:'/(tabs)/discover',description:'Discover is where you find your next book and connect with other readers.'},
 {title:'Find a book',anchor:'discover-books',path:'/discover',route:'/(tabs)/discover',description:'Search a title or author, browse trending books, or scan a barcode. Open a book to add it as TBR, Reading, Read or DNF.'},
 {title:'Find your readers',anchor:'discover-readers',path:'/discover',route:'/(tabs)/discover',description:'Switch to Readers to search for people. Visit a profile, explore their books and follow readers you enjoy.'},
 {title:'Make something worth sharing',anchor:'tab-create',path:'/post',route:'/(tabs)/post',description:'The + button opens your creation hub: posts, reading updates, questions and book stacks.'},
 {title:'Start a conversation',anchor:'create-post',path:'/post',route:'/(tabs)/post',description:'Use Post to share a thought or photo. Choose Your Feed or a club before publishing, and mark spoilers when you reveal plot details.'},
 {title:'Share your reading progress',anchor:'create-reading-update',path:'/post',route:'/(tabs)/post',description:'Reading Update shares your current book, page or chapter, and thoughts so far. Choose your audience and flag spoilers before publishing.'},
 {title:'Ask the community',anchor:'create-ask-readers',path:'/post',route:'/(tabs)/post',description:'Ask Readers starts a question for your feed or a club. Get recommendations, compare favorites, or open a discussion.'},
 {title:'Build a book stack',anchor:'create-book-stack',path:'/post',route:'/(tabs)/post',description:'Book Stack groups books around a theme. Name your stack, choose and arrange its books, then save it to your profile or share it as a post.'},
 {title:'Your own library',anchor:'tab-library',path:'/library',route:'/(tabs)/library',description:'Your books are organized here. Search and filter your library, then tap a cover to reopen its details.'},
 {title:'Make Novori yours',anchor:'tab-profile',path:'/profile',route:'/(tabs)/profile',description:'Your profile holds your books, reviews and stacks. Open My Reading for check-ins, recaps and goals. Replay this tour from Settings anytime.'},
] as const;
export function needsTutorial(metadata?: Record<string,unknown>) {
 return metadata?.novori_tutorial_pending === true && metadata?.novori_tutorial_version !== TUTORIAL_VERSION;
}
export async function finishTutorial() {
 const {data:{user},error}=await supabase.auth.getUser();
 if(error)throw error;
 if(!user)throw new Error('Please sign in to save your tutorial progress.');
 const {data,error:saveError}=await supabase.auth.updateUser({data:{novori_tutorial_pending:false,novori_tutorial_version:TUTORIAL_VERSION,novori_tutorial_completed_at:new Date().toISOString()}});
 if(saveError)throw saveError;
 if(data.user?.id!==user.id)throw new Error('Please sign in again and retry.');
}

/** Preserve visible cards; reveal only the portion outside the usable viewport. */
export function tutorialRevealOffset(y:number,height:number,offset:number,top:number,bottom:number){
 const delta=y<top?y-top:y+height>bottom?y+height-bottom:0;
 return Math.max(0,offset+delta);
}
