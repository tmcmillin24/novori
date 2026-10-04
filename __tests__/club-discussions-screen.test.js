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
import {getExplicitLanguagePreference} from '../src/lib/content-filter';
import {supabase} from '../src/lib/supabase';
import {blockReader} from '../src/lib/social';
import {getPostComments,createPostComment,deletePostComment,toggleCommentVote,updatePostComment} from '../src/lib/comments';

let mockParams={};const mockRouter={back:jest.fn(),push:jest.fn(),replace:jest.fn(),setParams:jest.fn(),dismissTo:jest.fn()};
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
jest.mock('../src/lib/content-filter',()=>({containsExplicitLanguage:()=>false,getExplicitLanguagePreference:jest.fn(async()=>false),isExplicitContentRevealed:()=>false,revealExplicitContentOnce:jest.fn(),setExplicitLanguagePreference:jest.fn()}));
jest.mock('../src/lib/reports',()=>({submitCommentReport:jest.fn()}));
jest.mock('../src/lib/social',()=>({blockReader:jest.fn()}));
jest.mock('../src/lib/share-links',()=>({sharePostLink:jest.fn()}));
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:'member-1'}}}),getSession:jest.fn(async()=>({data:{session:{user:{id:'member-1'},access_token:'test-token'}}})),onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{}}}})}}}));

const book={googleBookId:'cached-book',isbn:'9781234567897',title:'Stored book',authors:['Stored author'],coverUrl:'stored-canonical-cover'};
const read={id:'read-1',club_id:'club-1',status:'current',book};
const topic={id:'discussion-1',club_id:'club-1',post_id:'post-1',read_id:'read-1',created_by:'member-1',kind:'discussion',title:'The secret ending',prompt:'The narrator is the villain.',book,contains_spoilers:true,spoiler_label:'Whole book',options:[],closed_at:null,voting_started_at:null,updated_at:'2026-10-03T10:00:00Z',created_at:'2026-10-03T10:00:00Z',viewer_is_member:true,viewer_can_manage:true};
const poll={...topic,kind:'poll',contains_spoilers:false,title:'Next read?',prompt:'Choose our next book.',options:['Fantasy','Mystery'],vote_counts:[0,0],viewer_choice:null};
const club={id:'club-1',name:'Readers Club',membership_role:'member'};
const post={id:'post-1',club_id:'club-1',author_id:'member-1',author_display_name:'A Reader',author_username:'reader',body:'Join this club discussion.',post_type:'post',created_at:topic.created_at,updated_at:topic.updated_at,upvote_count:0,downvote_count:0,vote_score:0,viewer_vote:0,comment_count:1,club_discussion:topic};
const comment={id:'comment-1',post_id:'post-1',author_id:'member-2',parent_comment_id:null,body:'Spoiler reply from a reader.',author_display_name:'Another Reader',author_username:'another',created_at:topic.created_at,updated_at:topic.updated_at,is_own:false,upvote_count:0,downvote_count:0,vote_score:0,viewer_vote:0};
let view,silence;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.useFakeTimers();jest.clearAllMocks();getPostComments.mockReset();getPostDetail.mockReset();getExplicitLanguagePreference.mockReset();createPostComment.mockReset();mockParams={clubId:'club-1'};getClub.mockResolvedValue(club);getClubRead.mockResolvedValue(read);getClubReads.mockResolvedValue({current:read,upcoming:[],past:[],upcoming_more:false,past_more:false});getClubDiscussion.mockResolvedValue(topic);getClubDiscussions.mockResolvedValue([]);saveClubDiscussion.mockResolvedValue('post-1');closeClubPoll.mockResolvedValue();voteClubPoll.mockImplementation(async(_,choice)=>({...poll,viewer_choice:choice,vote_counts:choice===null?[0,0]:[choice===0?1:0,choice===1?1:0],voting_started_at:topic.updated_at}));getExplicitLanguagePreference.mockResolvedValue(false);getPostDetail.mockResolvedValue(post);getPostComments.mockResolvedValue([comment]);silence=jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;jest.useRealTimers();silence.mockRestore();});
async function render(el){await act(async()=>{view=renderer.create(el);});}
const button=label=>view.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel===label);
const field=label=>view.root.findAllByType('TextInput').find(n=>n.props.accessibilityLabel===label);
async function press(label){expect(button(label)).toBeDefined();await act(async()=>button(label).props.onPress());}
async function fill(label,value){await act(async()=>field(label).props.onChangeText(value));}
async function chooseReply(id){await act(async()=>button('Comment: '+id).props.onLongPress());const reply=view.root.findAllByType('Pressable').find(n=>n.findAllByType('Text').some(t=>t.props.children==='Reply'));expect(reply).toBeDefined();await act(async()=>reply.props.onPress());}
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
 expect(text()).toContain('Reply at depth 2');expect(text()).not.toContain('Reply at depth 3');await press('View conversation: chain-2');
 expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/post/[id]/conversation',params:{id:'post-1',threadId:'chain-2',commentId:'chain-2'}});
});
test('focused conversation starts at the selected comment and replies only after explicit selection',async()=>{
 mockParams={id:'post-1',threadId:'chain-2',commentId:'chain-2'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValue([...chain(),{...comment,id:'unrelated',body:'Unrelated conversation.'}]);
 createPostComment.mockResolvedValue('new-reply');await render(<PostDetailScreen/>);
 expect(text()).toContain('Reply at depth 2');expect(text()).toContain('Reply at depth 4');expect(text()).not.toContain('Reply at depth 0');expect(text()).not.toContain('Reply at depth 1');expect(text()).not.toContain('Replying to');expect(text()).not.toContain('Unrelated conversation.');
 await chooseReply('chain-2');await fill('Comment reply text','A focused reply.');await press('Send comment');
 expect(createPostComment).toHaveBeenCalledWith('post-1','A focused reply.','chain-2');await press('Back to post');expect(mockRouter.dismissTo).toHaveBeenCalledWith({pathname:'/post/[id]',params:{id:'post-1'}});
});
test('deep notification targets open a readable branch automatically',async()=>{
 mockParams={id:'post-1',commentId:'chain-5'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValue(chain());await render(<PostDetailScreen/>);expect(text()).toContain('Conversation');expect(text()).toContain('Reply at depth 5');expect(text()).not.toContain('Reply at depth 0');expect(text()).not.toContain('Reply at depth 4');
});
test('missing focused comments cannot accidentally publish to the post root',async()=>{
 mockParams={id:'post-1',threadId:'deleted'};getPostDetail.mockResolvedValue({...post,club_discussion:null});await render(<PostDetailScreen/>);expect(text()).toContain('This conversation is no longer available');expect(view.root.findAllByType('KeyboardStickyView')).toHaveLength(0);expect(button('Back to post')).toBeDefined();
});
test('focused routes preserve spoiler protection for the comment branch',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};await render(<PostDetailScreen/>);expect(text()).not.toContain(comment.body);expect(view.root.findAllByType('KeyboardStickyView')).toHaveLength(0);await press('Reveal club discussion spoilers');expect(text()).toContain(comment.body);
});

test.each(['name','avatar','empty space'])('notification thread opens comment actions when holding the %s',async area=>{
 mockParams={id:'post-1',commentId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});await render(<PostDetailScreen/>);
 expect(button('Reply to comment: comment-1')).toBeDefined();expect(button('Comment options: comment-1')).toBeUndefined();
 const body=button('Comment: comment-1');
 let card=body.parent;while(card.type!=='Pressable')card=card.parent;
 const target=area==='name'?button('View reader: Another Reader'):area==='avatar'?button('View reader avatar: Another Reader'):card;
 await act(async()=>target.props.onLongPress());
 expect(text()).toContain('Reply');expect(text()).toContain('Report');expect(text()).toContain('Block');expect(mockRouter.push).not.toHaveBeenCalled();
});
test('focused notification replies use the Home placeholder and quote the parent comment',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});await render(<PostDetailScreen/>);
 expect(field('Comment reply text')).toBeUndefined();expect(text()).not.toContain('Replying to');await chooseReply('comment-1');expect(field('Comment reply text').props.placeholder).toBe('Write a reply…');
 const composer=view.root.findByType('KeyboardStickyView');const composerText=composer.findAllByType('Text').map(n=>[n.props.children].flat(Infinity).join('')).join(' ');
 expect(composerText).toContain('Replying to Another Reader');expect(composerText).toContain(comment.body);
 const backdrop=composer.findAllByType('View').find(n=>n.props.pointerEvents==='none'&&n.props.style?.height===844);expect(backdrop).toBeDefined();expect(backdrop.props.style.backgroundColor).toBe(require('../src/constants/novori-theme').DARK_COLORS.background);
});

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
test('a slow optional language preference never holds up the thread or enables explicit content',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getExplicitLanguagePreference.mockReturnValue(new Promise(()=>{}));await render(<PostDetailScreen/>);
 expect(text()).toContain(comment.body);expect(field('Comment reply text')).toBeDefined();expect(view.root.findAllByType('ActivityIndicator')).toHaveLength(0);
});
test('a transient preference failure does not emit the red error overlay',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getExplicitLanguagePreference.mockRejectedValue({code:'',message:'fetch failed: The network connection was lost.'});await render(<PostDetailScreen/>);
 expect(text()).toContain(comment.body);expect(console.error).not.toHaveBeenCalled();
});
test('a saved comment survives a failed follow-up read without restoring the draft or reporting a failed save',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValueOnce([comment]).mockRejectedValueOnce(new Error('Network connection lost'));createPostComment.mockResolvedValue('confirmed-comment');await render(<PostDetailScreen/>);
 await chooseReply('comment-1');await fill('Comment reply text','My saved reply');await press('Send comment');
 expect(createPostComment).toHaveBeenCalledWith('post-1','My saved reply','comment-1');expect(text()).toContain('My saved reply');expect(text()).toContain('Your comment was saved.');expect(field('Comment reply text')).toBeUndefined();expect(require('react-native').Alert.alert).not.toHaveBeenCalled();expect(button('Comment: confirmed-comment')).toBeDefined();
});
test('a failing write restores its draft and rapid repeated taps create only one request',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});const write=deferred();createPostComment.mockReturnValue(write.promise);await render(<PostDetailScreen/>);await chooseReply('comment-1');await fill('Comment reply text','Keep my draft');
 const send=button('Send comment').props.onPress;let first;
 await act(async()=>{first=send();await send();});expect(createPostComment).toHaveBeenCalledTimes(1);expect(text()).toContain('Keep my draft');
 await act(async()=>{write.reject(new Error('Could not connect'));await first;});expect(field('Comment reply text').props.value).toBe('Keep my draft');expect(text()).toContain('Replying to Another Reader');expect(require('react-native').Alert.alert).toHaveBeenCalledWith('Could not comment','Could not connect');
});
test('late responses from an earlier route cannot replace the newly opened post',async()=>{
 mockParams={id:'post-1'};const oldRead=deferred();getPostDetail.mockReturnValueOnce(oldRead.promise).mockResolvedValueOnce({...post,id:'post-2',body:'Second post',club_discussion:null});await render(<PostDetailScreen/>);
 mockParams={id:'post-2'};await act(async()=>view.update(<PostDetailScreen/>));expect(text()).toContain('Second post');
 await act(async()=>oldRead.resolve({...post,body:'Old response',club_discussion:null}));expect(text()).toContain('Second post');expect(text()).not.toContain('Old response');
});
test('refresh keeps an existing conversation visible and offers retry on a temporary outage',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});await render(<PostDetailScreen/>);getPostComments.mockRejectedValueOnce(new Error('Network connection lost'));
 await act(async()=>view.root.findByType('ScrollView').props.refreshControl.props.onRefresh());expect(text()).toContain(comment.body);expect(button('Retry refreshing thread')).toBeDefined();expect(getPostComments).toHaveBeenLastCalledWith('post-1',500,{force:true});
});

test('a successful deletion removes its entire local branch even if the refresh fails',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,comment_count:2,club_discussion:null});const own={...comment,is_own:true};getPostComments.mockResolvedValueOnce([own,{...comment,id:'child',parent_comment_id:own.id,body:'Child reply'}]).mockRejectedValueOnce(new Error('Network connection lost'));deletePostComment.mockResolvedValue();await render(<PostDetailScreen/>);
 await act(async()=>button('Comment: comment-1').props.onLongPress());
 const action=view.root.findAllByType('Pressable').find(n=>n.findAllByType('Text').some(t=>t.props.children==='Delete'));
 expect(action).toBeDefined();await act(async()=>action.props.onPress());await act(async()=>jest.advanceTimersByTime(110));
 const confirmation=view.root.findByType('DeletePostConfirmSheet');expect(confirmation.props.title).toBe('Delete comment?');expect(confirmation.props.visible).toBe(true);expect(deletePostComment).not.toHaveBeenCalled();await act(async()=>confirmation.props.onConfirm());
 expect(deletePostComment).toHaveBeenCalledWith('comment-1');expect(text()).not.toContain(comment.body);expect(text()).not.toContain('Child reply');expect(button('Retry refreshing thread')).toBeDefined();
});
test('editing an own comment uses the correct ID and retains the confirmed text',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValue([{...comment,is_own:true}]);updatePostComment.mockResolvedValue();await render(<PostDetailScreen/>);
 await act(async()=>button('Comment: comment-1').props.onLongPress());const edit=view.root.findAllByType('Pressable').find(n=>n.findAllByType('Text').some(t=>t.props.children==='Edit'));expect(edit).toBeDefined();await act(async()=>edit.props.onPress());await act(async()=>jest.advanceTimersByTime(110));await fill('Comment reply text','Edited comment');await press('Send comment');expect(updatePostComment).toHaveBeenCalledWith('comment-1','Edited comment');expect(text()).toContain('Edited comment');expect(field('Comment reply text').props.value).toBe('');
});
test('comment voting applies the server result and blocked/deleted rows cannot expose actions',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});toggleCommentVote.mockResolvedValue({viewer_vote:1,vote_score:1,upvote_count:1,downvote_count:0});getPostComments.mockResolvedValue([comment,{...comment,id:'blocked',is_blocked_author:true},{...comment,id:'deleted',is_deleted:true,body:'This comment was deleted.'}]);await render(<PostDetailScreen/>);
 await press('Upvote comment: comment-1');expect(toggleCommentVote).toHaveBeenCalledWith('comment-1',1);expect(button('Upvote comment: comment-1').findByType('Icon').props.name).toBe('arrow-up');expect(button('Comment: blocked')).toBeUndefined();await act(async()=>button('Comment: deleted').props.onLongPress());expect(text()).not.toContain('Choose an action for this comment.');
});

test('voting on another comment during a pending save cannot strand the saved reply with a temporary ID',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValueOnce([comment]).mockRejectedValueOnce(new Error('Network connection lost'));const write=deferred();createPostComment.mockReturnValue(write.promise);toggleCommentVote.mockResolvedValue({viewer_vote:1,vote_score:1,upvote_count:1,downvote_count:0});await render(<PostDetailScreen/>);await chooseReply('comment-1');await fill('Comment reply text','Saved while voting');let sending;
 await act(async()=>{sending=button('Send comment').props.onPress();});expect(field('Comment reply text')).toBeUndefined();await press('Upvote comment: comment-1');await act(async()=>{write.resolve('saved-comment');await sending;});expect(button('Comment: saved-comment')).toBeDefined();expect(field('Comment reply text')).toBeUndefined();expect(text()).not.toContain('Replying to');expect(text()).toContain('Your comment was saved.');
});
test('blocking masks a parent immediately and preserves another reader’s replies during a failed refresh',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValueOnce([comment,{...comment,id:'child',author_id:'member-3',parent_comment_id:comment.id,body:'Unblocked child'}]).mockRejectedValueOnce(new Error('Network connection lost'));blockReader.mockResolvedValue();await render(<PostDetailScreen/>);await act(async()=>button('Comment: comment-1').props.onLongPress());const action=view.root.findAllByType('Pressable').find(n=>n.findAllByType('Text').some(t=>t.props.children==='Block reader'));expect(action).toBeDefined();await act(async()=>action.props.onPress());await act(async()=>jest.advanceTimersByTime(110));const sheet=view.root.findByType('BlockReaderConfirmSheet');await act(async()=>sheet.props.onConfirm());expect(blockReader).toHaveBeenCalledWith('member-2');expect(text()).toContain('Blocked reader · This comment is hidden.');expect(text()).not.toContain(comment.body);expect(text()).toContain('Unblocked child');
});

test('focused views cannot post automatically to either the selected comment or the post root',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});await render(<PostDetailScreen/>);expect(field('Comment reply text')).toBeUndefined();expect(button('Send comment')).toBeUndefined();expect(createPostComment).not.toHaveBeenCalled();expect(text()).not.toContain('Replying to');
});
test('reply branches expand three at a time and collapse without retrieving the thread again',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});const replies=Array.from({length:8},(_,i)=>({...comment,id:'reply-'+i,parent_comment_id:'comment-1',body:'Branch reply '+i,vote_score:8-i}));getPostComments.mockResolvedValue([comment,...replies]);await render(<PostDetailScreen/>);
 expect(text()).toContain('Branch reply 2');expect(text()).not.toContain('Branch reply 3');expect(button('Show more replies: comment-1')).toBeDefined();await press('Show more replies: comment-1');expect(text()).toContain('Branch reply 5');expect(text()).not.toContain('Branch reply 6');await press('Show more replies: comment-1');expect(text()).toContain('Branch reply 7');expect(button('Show more replies: comment-1')).toBeUndefined();await press('Show fewer replies: comment-1');expect(text()).not.toContain('Branch reply 3');expect(getPostComments).toHaveBeenCalledTimes(1);
});
test('selected conversations exclude ancestors and unrelated sibling branches',async()=>{
 mockParams={id:'post-1',threadId:'chain-2'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValue([...chain(),{...comment,id:'root-sibling',parent_comment_id:'chain-0',body:'Root sibling branch'},{...comment,id:'middle-sibling',parent_comment_id:'chain-1',body:'Middle sibling branch'}]);await render(<PostDetailScreen/>);for(const depth of [2,3,4])expect(text()).toContain('Reply at depth '+depth);for(const depth of [0,1])expect(text()).not.toContain('Reply at depth '+depth);expect(text()).not.toContain('Root sibling branch');expect(text()).not.toContain('Middle sibling branch');expect(text()).not.toContain('Reply at depth 5');expect(button('View conversation: chain-4')).toBeDefined();expect(text()).not.toContain('Replying to');
});
test('focused conversations offer Back to post without a parent context button',async()=>{
 mockParams={id:'post-1',threadId:'chain-2'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValue(chain());await render(<PostDetailScreen/>);expect(button('Comment: chain-1')).toBeUndefined();expect(button('View parent comment')).toBeUndefined();await press('Back to post');expect(mockRouter.dismissTo).toHaveBeenCalledWith({pathname:'/post/[id]',params:{id:'post-1'}});expect(createPostComment).not.toHaveBeenCalled();
});

test('reply arrow explicitly selects its comment and submits to that parent',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});createPostComment.mockResolvedValue('arrow-reply');await render(<PostDetailScreen/>);expect(text()).not.toContain('Replying to');await press('Reply to comment: comment-1');expect(text()).toContain('Replying to Another Reader');expect(field('Comment reply text').props.placeholder).toBe('Write a reply…');await fill('Comment reply text','Arrow reply');await press('Send comment');expect(createPostComment).toHaveBeenCalledWith('post-1','Arrow reply','comment-1');
});
test('siblings stay aligned and only a reply to one sibling creates a deeper branch',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});const siblings=Array.from({length:3},(_,i)=>({...comment,id:'sibling-'+i,parent_comment_id:'comment-1',body:'Sibling '+i,vote_score:3-i}));getPostComments.mockResolvedValue([comment,...siblings,{...comment,id:'grandchild',parent_comment_id:'sibling-2',body:'Reply to third sibling'}]);await render(<PostDetailScreen/>);
 const container=id=>{let node=button('Comment: '+id).parent;while(node.type!=='Pressable')node=node.parent;return node.parent;};const margin=node=>Object.assign({},...[node.props.style].flat()).marginLeft??0;
 expect(margin(container('comment-1'))).toBe(0);for(const sibling of siblings)expect(margin(container(sibling.id))).toBe(14);expect(margin(container('grandchild'))).toBe(14);let ancestor=container('grandchild').parent;while(ancestor&&ancestor!==container('sibling-2'))ancestor=ancestor.parent;expect(ancestor).toBe(container('sibling-2'));
});

test('continued conversation sibling rows share one inset and Back pops the previous screen',async()=>{
 mockParams={id:'post-1',threadId:'chain-2'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValue([...chain().slice(0,3),...Array.from({length:3},(_,i)=>({...comment,id:'focused-sibling-'+i,parent_comment_id:'chain-2',body:'Focused sibling '+i}))]);await render(<PostDetailScreen/>);
 const container=id=>{let node=button('Comment: '+id).parent;while(node.type!=='Pressable')node=node.parent;return node.parent;};const inset=node=>{const style=Object.assign({},...[node.props.style].flat());return (style.marginLeft??0)+(style.paddingLeft??0);};
 expect(button('Comment: chain-0')).toBeUndefined();expect(button('Comment: chain-1')).toBeUndefined();expect(inset(container('chain-2'))).toBe(0);for(let i=0;i<3;i++)expect(inset(container('focused-sibling-'+i))).toBe(23);await press('Back to previous screen');expect(mockRouter.back).toHaveBeenCalledTimes(1);expect(mockRouter.replace).not.toHaveBeenCalled();
});

test('a root conversation offers no parent action and preserves the reply label count',async()=>{
 mockParams={id:'post-1',threadId:'chain-0'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValue(chain().slice(0,4));await render(<PostDetailScreen/>);expect(button('View parent comment')).toBeUndefined();expect(text()).toContain('View conversation · 1 reply');expect(text()).not.toContain('Continue conversation');
});

test('focused reading hides the post and composer until Reply is chosen, then cancellation restores reading mode',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null,body:'Original post only'});await render(<PostDetailScreen/>);expect(text()).not.toContain('Original post only');expect(text()).toContain(comment.body);expect(view.root.findAllByType('KeyboardStickyView')).toHaveLength(0);await press('Reply to comment: comment-1');expect(field('Comment reply text')).toBeDefined();await press('Cancel reply');expect(view.root.findAllByType('KeyboardStickyView')).toHaveLength(0);expect(text()).not.toContain('Choose a comment');
});
test('comment deletion can be cancelled without issuing a write',async()=>{
 mockParams={id:'post-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});getPostComments.mockResolvedValue([{...comment,is_own:true}]);await render(<PostDetailScreen/>);await act(async()=>button('Comment: comment-1').props.onLongPress());const action=view.root.findAllByType('Pressable').find(n=>n.findAllByType('Text').some(t=>t.props.children==='Delete'));await act(async()=>action.props.onPress());await act(async()=>jest.advanceTimersByTime(110));const sheet=view.root.findByType('DeletePostConfirmSheet');expect(sheet.props.visible).toBe(true);await act(async()=>sheet.props.onDismiss());expect(view.root.findByType('DeletePostConfirmSheet').props.visible).toBe(false);expect(deletePostComment).not.toHaveBeenCalled();
});

test('focused conversations have one title instead of repeating the header',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});await render(<PostDetailScreen/>);expect(view.root.findAllByType('Text').filter(node=>node.props.children==='Conversation')).toHaveLength(1);
});

test('conversation header uses balanced sides and groups its count with sorting',async()=>{
 mockParams={id:'post-1',threadId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});await render(<PostDetailScreen/>);const style=node=>Object.assign({},...[typeof node.props.style==='function'?node.props.style({pressed:false}):node.props.style].flat());expect(style(button('Back to previous screen')).width).toBe(style(button('Back to post')).width);const title=view.root.findAllByType('Text').find(node=>node.props.children==='Conversation');expect(style(title)).toMatchObject({flex:1,textAlign:'center'});expect(style(title.parent).paddingHorizontal).toBe(16);expect(view.root.findByType('ScrollView').props.contentContainerStyle.paddingHorizontal).toBe(16);expect(text()).toContain('1 comment');const toolbar=view.root.findAllByType('View').find(node=>style(node).justifyContent==='space-between'&&style(node).paddingBottom===12);expect(toolbar).toBeDefined();expect(toolbar.findAllByType('Text').map(node=>node.props.children)).toEqual(expect.arrayContaining(['Top','Newest']));
});

test('a loading conversation keeps its header at the top and does not schedule an entrance scroll',async()=>{
 mockParams={id:'post-1',threadId:'comment-1',commentId:'comment-1'};getPostDetail.mockResolvedValue({...post,club_discussion:null});const read=deferred();getPostComments.mockReturnValue(read.promise);const timers=jest.spyOn(global,'setTimeout');await render(<PostDetailScreen/>);expect(text()).toContain('Conversation');expect(text()).toContain('Loading conversation…');expect(button('Back to previous screen')).toBeDefined();expect(view.root.findAllByType('ActivityIndicator').map(node=>node.props.size)).toEqual(['small']);await act(async()=>read.resolve([comment]));expect(text()).toContain(comment.body);expect(text()).not.toContain('Loading conversation…');expect(timers.mock.calls.some(call=>call[1]===450)).toBe(false);timers.mockRestore();
});
