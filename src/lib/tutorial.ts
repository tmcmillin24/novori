import { supabase } from './supabase';
export const TUTORIAL_VERSION = '1';
export const TUTORIAL_STEPS = [
 {title:'Your reading community',icon:'home-outline',tab:'Home',description:'Home brings together posts from readers you follow and the clubs you join. Open a post to read the full conversation.',tip:'Tap a reader’s name to explore their profile.'},
 {title:'Find your next book',icon:'compass-outline',tab:'Discover',description:'Search for a title or author in Discover. Browse trending books and recent releases, or scan a book’s barcode.',tip:'Discover also helps you find readers and clubs.'},
 {title:'Make a book yours',icon:'book-outline',tab:'Discover',description:'Open a book for its description, series and community reviews. Choose TBR, Reading, Read or DNF to add it to your library.',tip:'You can also mark a book as owned.'},
 {title:'A library that follows you',icon:'library-outline',tab:'Library',description:'Your library keeps your books together. Use its search and filters to find what you want to read, what you’re reading and what you’ve finished.',tip:'Tap a cover to reopen that book’s details.'},
 {title:'Share a thought',icon:'create-outline',tab:'Create',description:'Use the + button to create a post or Ask Readers a question. Choose Your Feed or a club as the destination before publishing.',tip:'Turn on the spoiler warning when your post reveals plot details.'},
 {title:'Share your progress',icon:'bookmark-outline',tab:'Create',description:'Create a Reading Update to share where you are in a book. Add your progress and a thought, then choose where to post it.',tip:'Private reading notes stay private; your shared update is separate.'},
 {title:'Build a book stack',icon:'albums-outline',tab:'Create',description:'Create a themed collection with Book Stack. Pick its books, arrange them and give the stack a name. Save it to your profile or share it as a post.',tip:'Open a stack from a profile to explore the books inside.'},
 {title:'Join the conversation',icon:'chatbubbles-outline',tab:'Home',description:'Tap the comment button to open the comments. Use the reply arrow or press and hold a comment to reply. View conversation opens that branch of replies.',tip:'Press and hold also gives you report and block options.'},
 {title:'Find your people',icon:'people-outline',tab:'Clubs',description:'Join clubs to discuss books, take part in discussions and polls, and see events and club reading picks. Your beta club is a place to share feedback.',tip:'Use the club’s bell to manage its notifications. You can leave a club at any time.'},
 {title:'Your reading, your pace',icon:'person-outline',tab:'Profile',description:'Your profile brings together your books, reviews and stacks. Open My Reading for check-ins, reading activity, recaps and goals.',tip:'You can revisit this guide anytime in Settings → View tutorial.'},
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
