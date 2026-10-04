import React from 'react';
import renderer,{act} from 'react-test-renderer';
import CreateClubDiscussionScreen from '../src/app/create-club-discussion';
import ClubDiscussionsScreen from '../src/app/club-discussions';
import ClubDiscussionPostAttachment from '../src/components/ClubDiscussionPostAttachment';
import PostDetailScreen from '../src/app/post/[id]';
import {getClub} from '../src/lib/clubs';
import {getClubRead,getClubReads} from '../src/lib/club-reads';
import {getClubDiscussion,getClubDiscussions,saveClubDiscussion,voteClubPoll,closeClubPoll} from '../src/lib/club-discussions';
import {getPostDetail} from '../src/lib/feed';
import {getPostComments,createPostComment} from '../src/lib/comments';

let mockParams={};const mockRouter={back:jest.fn(),push:jest.fn(),replace:jest.fn()};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useLocalSearchParams:()=>mockParams,useFocusEffect:cb=>require('react').useEffect(cb,[cb])}));
jest.mock('react-native',()=>({
 useWindowDimensions:()=>({width:390,height:844}),Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},ActivityIndicator:'ActivityIndicator',Text:'Text',TextInput:'TextInput',View:'View',Image:'Image',Pressable:'Pressable',ScrollView:'ScrollView',RefreshControl:'RefreshControl',
 Modal:p=>p.visible?require('react').createElement('Modal',p,p.children):null,Alert:{alert:jest.fn()},Keyboard:{addListener:()=>({remove:()=>{}}),dismiss:jest.fn()},StyleSheet:{create:v=>v,absoluteFill:{},hairlineWidth:.5},
 Animated:{View:'AnimatedView',Value:class{setValue(){}stopAnimation(){}interpolate(){return 0;}},parallel:()=>({start:f=>f?.({finished:true})}),timing:()=>({start:f=>f?.({finished:true})}),spring:()=>({start:f=>f?.({finished:true})})},
 Easing:{out:v=>v,in:v=>v,inOut:v=>v,cubic:()=>{},quad:()=>{}},PanResponder:{create:()=>({panHandlers:{}})},
}));
jest.mock('react-native-keyboard-controller',()=>({KeyboardAwareScrollView:'KeyboardAwareScrollView',KeyboardStickyView:'KeyboardStickyView'}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView',useSafeAreaInsets:()=>({bottom:0})}));
jest.mock('expo-blur',()=>({BlurView:'BlurView'}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').DARK_COLORS})}));
jest.mock('../src/components/BookCoverImage',()=> 'BookCoverImage');
jest.mock('../src/components/DeletePostConfirmSheet',()=> 'DeletePostConfirmSheet');
jest.mock('../src/components/BlockReaderConfirmSheet',()=> 'BlockReaderConfirmSheet');
jest.mock('../src/components/BookStackPostAttachment',()=> 'BookStackPostAttachment');
jest.mock('../src/components/CanonicalBookRating',()=> 'CanonicalBookRating');
jest.mock('../src/components/ReadingRecapPostAttachment',()=> 'ReadingRecapPostAttachment');
jest.mock('../src/components/ClubEventPostAttachment',()=> 'ClubEventPostAttachment');
jest.mock('../src/lib/clubs',()=>({getClub:jest.fn()}));
jest.mock('../src/lib/club-reads',()=>({getClubRead:jest.fn(),getClubReads:jest.fn()}));
jest.mock('../src/lib/club-discussions',()=>({CLUB_DISCUSSIONS_PAGE_SIZE:20,getClubDiscussion:jest.fn(),getClubDiscussions:jest.fn(),saveClubDiscussion:jest.fn(),voteClubPoll:jest.fn(),closeClubPoll:jest.fn(),newClubDiscussionRequestKey:()=> 'stable-discussion-request-key'}));
jest.mock('../src/lib/feed',()=>({getPostDetail:jest.fn(),togglePostVote:jest.fn(),splitQuestionPostBody:()=>null}));
jest.mock('../src/lib/comments',()=>({getPostComments:jest.fn(),createPostComment:jest.fn(),deletePostComment:jest.fn(),toggleCommentVote:jest.fn(),updatePostComment:jest.fn()}));
jest.mock('../src/lib/content-filter',()=>({containsExplicitLanguage:()=>false,getExplicitLanguagePreference:async()=>false,isExplicitContentRevealed:()=>false,revealExplicitContentOnce:jest.fn(),setExplicitLanguagePreference:jest.fn()}));
jest.mock('../src/lib/reports',()=>({submitCommentReport:jest.fn()}));
jest.mock('../src/lib/social',()=>({blockReader:jest.fn()}));
jest.mock('../src/lib/share-links',()=>({sharePostLink:jest.fn()}));
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:'member-1'}}})}}}));

const book={googleBookId:'cached-book',isbn:'9781234567897',title:'Stored book',authors:['Stored author'],coverUrl:'stored-canonical-cover'};
const read={id:'read-1',club_id:'club-1',status:'current',book};
const topic={id:'discussion-1',club_id:'club-1',post_id:'post-1',read_id:'read-1',created_by:'member-1',kind:'discussion',title:'The secret ending',prompt:'The narrator is the villain.',book,contains_spoilers:true,spoiler_label:'Whole book',options:[],closed_at:null,voting_started_at:null,updated_at:'2026-10-03T10:00:00Z',created_at:'2026-10-03T10:00:00Z',viewer_is_member:true,viewer_can_manage:true};
const poll={...topic,kind:'poll',contains_spoilers:false,title:'Next read?',prompt:'Choose our next book.',options:['Fantasy','Mystery'],vote_counts:[0,0],viewer_choice:null};
const club={id:'club-1',name:'Readers Club',membership_role:'member'};
const post={id:'post-1',club_id:'club-1',author_id:'member-1',author_display_name:'A Reader',author_username:'reader',body:'Join this club discussion.',post_type:'post',created_at:topic.created_at,updated_at:topic.updated_at,upvote_count:0,downvote_count:0,vote_score:0,viewer_vote:0,comment_count:1,club_discussion:topic};
const comment={id:'comment-1',post_id:'post-1',author_id:'member-2',parent_comment_id:null,body:'Spoiler reply from a reader.',author_display_name:'Another Reader',author_username:'another',created_at:topic.created_at,updated_at:topic.updated_at,is_own:false,upvote_count:0,downvote_count:0,vote_score:0,viewer_vote:0};
let view,silence;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.useFakeTimers();jest.clearAllMocks();mockParams={clubId:'club-1'};getClub.mockResolvedValue(club);getClubRead.mockResolvedValue(read);getClubReads.mockResolvedValue({current:read,upcoming:[],past:[],upcoming_more:false,past_more:false});getClubDiscussion.mockResolvedValue(topic);getClubDiscussions.mockResolvedValue([]);saveClubDiscussion.mockResolvedValue('post-1');closeClubPoll.mockResolvedValue();voteClubPoll.mockImplementation(async(_,choice)=>({...poll,viewer_choice:choice,vote_counts:choice===null?[0,0]:[choice===0?1:0,choice===1?1:0],voting_started_at:topic.updated_at}));getPostDetail.mockResolvedValue(post);getPostComments.mockResolvedValue([comment]);silence=jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;jest.useRealTimers();silence.mockRestore();});
async function render(el){await act(async()=>{view=renderer.create(el);});}
const button=label=>view.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel===label);
const field=label=>view.root.findAllByType('TextInput').find(n=>n.props.accessibilityLabel===label);
async function press(label){expect(button(label)).toBeDefined();await act(async()=>button(label).props.onPress());}
async function fill(label,value){await act(async()=>field(label).props.onChangeText(value));}
const text=()=>view.root.findAllByType('Text').map(n=>[n.props.children].flat(Infinity).join('')).join(' ');

test('member fills the discussion card directly and posts with the stored club read',async()=>{
 await render(<CreateClubDiscussionScreen/>);await fill('Discussion title','Our reading chat');await fill('Discussion prompt','What did you think?');await press('Publish club discussion');
 expect(saveClubDiscussion).toHaveBeenCalledWith('club-1',expect.objectContaining({read_id:'read-1',kind:'discussion',title:'Our reading chat',prompt:'What did you think?'}),undefined,'stable-discussion-request-key');
 expect(mockRouter.replace).toHaveBeenCalledWith({pathname:'/post/[id]',params:{id:'post-1'}});expect(view.root.findByType('BookCoverImage').props.existingCoverUrl).toBe(book.coverUrl);expect(text()).not.toContain('Preview');
});
test('poll editor embeds choices and spoiler limit; save errors retain the whole draft',async()=>{
 mockParams={clubId:'club-1',kind:'poll'};saveClubDiscussion.mockRejectedValue(new Error('Choose unique poll choices.'));await render(<CreateClubDiscussionScreen/>);await fill('Discussion title','Next book');await fill('Poll choice 1','Fantasy');await fill('Poll choice 2','Mystery');await press('Add poll choice');await fill('Poll choice 3','Romance');await press('Discussion contains spoilers');await fill('Discussion spoiler limit','Through chapter 5');await press('Publish club discussion');
 expect(saveClubDiscussion).toHaveBeenCalledWith('club-1',expect.objectContaining({read_id:null,kind:'poll',options:['Fantasy','Mystery','Romance'],contains_spoilers:true,spoiler_label:'Through chapter 5'}),undefined,'stable-discussion-request-key');expect(field('Poll choice 3').props.value).toBe('Romance');expect(text()).toContain('Choose unique poll choices.');expect(mockRouter.replace).not.toHaveBeenCalled();
});
test('visitors and locked poll editors cannot publish',async()=>{
 getClub.mockResolvedValue({...club,membership_role:null});await render(<CreateClubDiscussionScreen/>);expect(button('Publish club discussion').props.disabled).toBe(true);expect(field('Discussion title')).toBeUndefined();await act(async()=>view.unmount());view=null;
 mockParams={clubId:'club-1',discussionId:'discussion-1'};getClub.mockResolvedValue(club);getClubDiscussion.mockResolvedValue({...poll,voting_started_at:topic.updated_at});await render(<CreateClubDiscussionScreen/>);expect(button('Publish club discussion').props.disabled).toBe(true);expect(text()).toContain('Polls lock after the first vote.');
});
test('feed attachment needs no detail RPC, hides spoilers, and uses canonical stored cover',async()=>{
 await render(<ClubDiscussionPostAttachment discussion={topic}/>);expect(getClubDiscussion).not.toHaveBeenCalled();expect(text()).not.toContain(topic.title);expect(text()).not.toContain(topic.prompt);expect(view.root.findByType('BookCoverImage').props).toEqual(expect.objectContaining({googleBookId:book.googleBookId,isbn:book.isbn,existingCoverUrl:book.coverUrl}));await press('Reveal club discussion spoilers');expect(text()).toContain(topic.prompt);await press('Open club discussion');expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/post/[id]',params:{id:'post-1'}});
});
test('detail poll updates confirmed votes, clears own selection, and closes with confirmation',async()=>{
 getClubDiscussion.mockResolvedValue(poll);await render(<ClubDiscussionPostAttachment discussion={poll} detail/>);await press('Vote: Fantasy');expect(voteClubPoll).toHaveBeenLastCalledWith('discussion-1',0);expect(button('Vote: Fantasy').props.accessibilityState.selected).toBe(true);expect(text()).toContain('100%');expect(button('Edit club discussion')).toBeUndefined();await press('Vote: Fantasy');expect(voteClubPoll).toHaveBeenLastCalledWith('discussion-1',null);await press('Close club poll');const confirm=view.root.findByType('DeletePostConfirmSheet');expect(confirm.props.visible).toBe(true);getClubDiscussion.mockResolvedValue({...poll,closed_at:topic.updated_at});await act(async()=>confirm.props.onConfirm());expect(closeClubPoll).toHaveBeenCalledWith('discussion-1');expect(button('Vote: Fantasy').props.disabled).toBe(true);expect(text()).toContain('Voting closed');
});
test('visitor can read public poll results but cannot vote',async()=>{
 const visitor={...poll,viewer_is_member:false,viewer_can_manage:false,vote_counts:[2,1]};getClubDiscussion.mockResolvedValue(visitor);await render(<ClubDiscussionPostAttachment discussion={visitor} detail/>);expect(button('Vote: Mystery').props.disabled).toBe(true);expect(button('Close club poll')).toBeUndefined();expect(text()).toContain('3 votes');expect(text()).toContain('Join this club to vote');
});
test('book-filtered board paginates without per-card API reads and passes selection to editor',async()=>{
 mockParams={clubId:'club-1',readId:'read-1'};getClubDiscussions.mockResolvedValueOnce(Array.from({length:20},(_,i)=>({...topic,id:'topic-'+i,post_id:'post-'+i}))).mockResolvedValueOnce([{...topic,id:'topic-20'}]);await render(<ClubDiscussionsScreen/>);expect(getClubDiscussions).toHaveBeenLastCalledWith('club-1','read-1','all');expect(getClubDiscussion).not.toHaveBeenCalled();await press('More club discussions');expect(getClubDiscussions).toHaveBeenLastCalledWith('club-1','read-1','all',20);await press('Start club poll');expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/create-club-discussion',params:{clubId:'club-1',readId:'read-1',kind:'poll'}});await press('Show club poll');expect(getClubDiscussions).toHaveBeenLastCalledWith('club-1','read-1','poll');
});
test('full post screen hides spoiler prompt, comments, and composer until explicit reveal',async()=>{
 mockParams={id:'post-1'};await render(<PostDetailScreen/>);expect(text()).not.toContain(topic.title);expect(text()).not.toContain(comment.body);expect(view.root.findAllByType('KeyboardStickyView')).toHaveLength(0);await press('Reveal club discussion spoilers');expect(text()).toContain(topic.prompt);expect(text()).toContain(comment.body);expect(view.root.findAllByType('KeyboardStickyView')).toHaveLength(1);
});
test('refreshing a revised spoiler discussion resets reveal for the whole comment thread',async()=>{
 mockParams={id:'post-1'};await render(<PostDetailScreen/>);await press('Reveal club discussion spoilers');const revised={...topic,updated_at:'2026-10-03T11:00:00Z',prompt:'A revised spoiler.'};getPostDetail.mockResolvedValue({...post,club_discussion:revised});getClubDiscussion.mockResolvedValue(revised);await act(async()=>view.root.findByType('ScrollView').props.refreshControl.props.onRefresh());expect(text()).not.toContain(revised.prompt);expect(text()).not.toContain(comment.body);expect(view.root.findAllByType('KeyboardStickyView')).toHaveLength(0);
});
test('newer detail metadata can enable spoiler protection for comments loaded with an older post snapshot',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,club_discussion:{...topic,contains_spoilers:false}});getClubDiscussion.mockResolvedValue({...topic,updated_at:'2026-10-03T11:00:00Z'});await render(<PostDetailScreen/>);expect(text()).not.toContain(comment.body);expect(view.root.findAllByType('KeyboardStickyView')).toHaveLength(0);expect(button('Reveal club discussion spoilers')).toBeDefined();
});
test('ordinary posts retain their comments and composer',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,body:'An ordinary post.',club_discussion:null});await render(<PostDetailScreen/>);expect(text()).toContain('An ordinary post.');expect(text()).toContain(comment.body);expect(view.root.findAllByType('KeyboardStickyView')).toHaveLength(1);expect(getClubDiscussion).not.toHaveBeenCalled();
});

const chain=()=>Array.from({length:6},(_,i)=>({...comment,id:'chain-'+i,parent_comment_id:i?'chain-'+(i-1):null,body:'Reply at depth '+i}));
test('compact post comments stop indenting and link to a focused conversation',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValue(chain());await render(<PostDetailScreen/>);
 expect(text()).toContain('Reply at depth 2');expect(text()).not.toContain('Reply at depth 3');await press('Continue conversation: chain-2');
 expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/post/[id]',params:{id:'post-1',threadId:'chain-2',commentId:'chain-2'}});
});
test('focused conversation shows only its branch and posts directly to that comment',async()=>{
 mockParams={id:'post-1',threadId:'chain-2',commentId:'chain-2'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValue([...chain(),{...comment,id:'unrelated',body:'Unrelated conversation.'}]);
 createPostComment.mockResolvedValue({...comment,id:'new-reply',parent_comment_id:'chain-2',body:'A focused reply.'});await render(<PostDetailScreen/>);
 expect(text()).toContain('Reply at depth 2');expect(text()).toContain('Reply at depth 4');expect(text()).not.toContain('Reply at depth 1');expect(text()).not.toContain('Unrelated conversation.');
 await fill('Comment reply text','A focused reply.');await press('Send comment');
 expect(createPostComment).toHaveBeenCalledWith('post-1','A focused reply.','chain-2');await press('View all post comments');expect(mockRouter.replace).toHaveBeenCalledWith({pathname:'/post/[id]',params:{id:'post-1'}});
});
test('deep notification targets open a readable branch automatically',async()=>{
 mockParams={id:'post-1',commentId:'chain-5'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValue(chain());await render(<PostDetailScreen/>);expect(text()).toContain('Focused conversation');expect(text()).toContain('Reply at depth 5');expect(text()).not.toContain('Reply at depth 0');
});
test('missing focused comments cannot accidentally publish to the post root',async()=>{
 mockParams={id:'post-1',threadId:'deleted'};getPostDetail.mockResolvedValue({...post,club_discussion:null});await render(<PostDetailScreen/>);expect(text()).toContain('This conversation is no longer available');expect(view.root.findAllByType('KeyboardStickyView')).toHaveLength(0);expect(button('View all post comments')).toBeDefined();
});
test('focused routes preserve spoiler protection for the comment branch',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};await render(<PostDetailScreen/>);expect(text()).not.toContain(comment.body);expect(view.root.findAllByType('KeyboardStickyView')).toHaveLength(0);await press('Reveal club discussion spoilers');expect(text()).toContain(comment.body);
});

test.each(['name','avatar','empty space'])('notification thread opens comment actions when holding the %s',async area=>{
 mockParams={id:'post-1',commentId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});await render(<PostDetailScreen/>);
 expect(button('Reply to comment: comment-1')).toBeUndefined();expect(button('Comment options: comment-1')).toBeUndefined();
 const body=button('Comment: comment-1');
 let card=body.parent;while(card.type!=='Pressable')card=card.parent;
 const target=area==='name'?button('View reader: Another Reader'):area==='avatar'?button('View reader avatar: Another Reader'):card;
 await act(async()=>target.props.onLongPress());
 expect(text()).toContain('Reply');expect(text()).toContain('Report');expect(text()).toContain('Block');expect(mockRouter.push).not.toHaveBeenCalled();
});
test('focused notification replies use the Home placeholder and quote the parent comment',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});await render(<PostDetailScreen/>);
 expect(field('Comment reply text').props.placeholder).toBe('Write a reply…');
 const composer=view.root.findByType('KeyboardStickyView');const composerText=composer.findAllByType('Text').map(n=>[n.props.children].flat(Infinity).join('')).join(' ');
 expect(composerText).toContain('Replying to Another Reader');expect(composerText).toContain(comment.body);
 const backdrop=composer.findAllByType('View').find(n=>n.props.pointerEvents==='none'&&n.props.style?.height===844);expect(backdrop).toBeDefined();expect(backdrop.props.style.backgroundColor).toBe(require('../src/constants/novori-theme').DARK_COLORS.background);
});
