import React from 'react';
import renderer,{act} from 'react-test-renderer';
import FeedPostCard from '../src/components/FeedPostCard';
const mockRouter={push:jest.fn()};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter}));
jest.mock('react-native',()=>({Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},ActivityIndicator:'ActivityIndicator',Image:'Image',Pressable:'Pressable',View:'View',Text:'Text',StyleSheet:{create:v=>v,absoluteFill:{}}}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('expo-blur',()=>({BlurView:'BlurView'}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').DARK_COLORS})}));
jest.mock('../src/lib/content-filter',()=>({containsExplicitLanguage:()=>false,isExplicitContentRevealed:()=>false,revealExplicitContentOnce:jest.fn(),setExplicitLanguagePreference:jest.fn()}));
jest.mock('../src/components/BookCoverImage',()=> 'BookCoverImage');
jest.mock('../src/components/BookStackPostAttachment',()=> 'BookStackPostAttachment');
jest.mock('../src/components/CanonicalBookRating',()=> 'CanonicalBookRating');
jest.mock('../src/components/ClubDiscussionPostAttachment',()=> 'ClubDiscussionPostAttachment');
jest.mock('../src/components/ClubEventPostAttachment',()=> 'ClubEventPostAttachment');
jest.mock('../src/components/FeedPostImage',()=> 'FeedPostImage');
jest.mock('../src/components/ReadingRecapPostAttachment',()=> 'ReadingRecapPostAttachment');
jest.mock('../src/components/ValidationWarningSheet',()=> 'ValidationWarningSheet');
jest.mock('../src/lib/supabase',()=>({supabase:{}}));
const post={id:'post',author_id:'reader',author_display_name:'Reader',author_username:'reader',body:'A post',post_type:'post',created_at:'2026-10-04T14:00:00Z',vote_score:2,viewer_vote:0,comment_count:3,book_title:null};
let view,silence;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.clearAllMocks();jest.useFakeTimers().setSystemTime(new Date('2026-10-04T14:01:00Z'));silence=jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;jest.useRealTimers();silence.mockRestore();});
async function render(props={}){const actions={onComments:jest.fn(),onVote:jest.fn(),onMore:jest.fn(),onShare:jest.fn(),...props};await act(async()=>{view=renderer.create(<FeedPostCard post={post} {...actions}/>);});return actions;}
const allText=()=>view.root.findAllByType('Text').map(n=>[n.props.children].flat(Infinity).join('')).join(' ');
const byLabel=label=>view.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel===label);
test('the shared card exposes feed header actions and the comment/vote footer',async()=>{const callbacks=await render();expect(allText()).toContain('3 comments');const event={stopPropagation:jest.fn()};await act(async()=>byLabel('More post options').props.onPress(event));expect(callbacks.onMore).toHaveBeenCalledWith(post);await act(async()=>byLabel('Share post').props.onPress(event));expect(callbacks.onShare).toHaveBeenCalledWith(post);const buttons=view.root.findAllByType('Pressable');const comment=buttons.find(b=>b.findAllByType('Icon').length===1&&b.findAllByType('Icon').some(i=>i.props.name==='chatbubble-outline'));await act(async()=>comment.props.onPress(event));expect(callbacks.onComments).toHaveBeenCalledWith(post);const up=buttons.find(b=>b.findAllByType('Icon').length===1&&b.findAllByType('Icon').some(i=>i.props.name==='arrow-up-circle-outline'));const down=buttons.find(b=>b.findAllByType('Icon').length===1&&b.findAllByType('Icon').some(i=>i.props.name==='arrow-down-circle-outline'));await act(async()=>up.props.onPress(event));await act(async()=>down.props.onPress(event));expect(callbacks.onVote.mock.calls).toEqual([['post',1],['post',-1]]);});
test('Home, own-profile and reader-profile handlers do not change the card layout',async()=>{await render({currentUserId:'viewer'});const serialize=()=>JSON.stringify(view.toJSON(),(key,value)=>key==='style'&&typeof value==='function'?value({pressed:false}):value);const reference=serialize();await act(async()=>{view.update(<FeedPostCard post={post} currentUserId="reader" onComments={()=>{}} onVote={()=>{}} onMore={()=>{}} onShare={()=>{}}/>);});expect(serialize()).toEqual(reference);});
test('photo/book attachments retain the feed treatment',async()=>{await render();await act(async()=>{view.update(<FeedPostCard post={{...post,post_image_url:'photo.jpg',google_book_id:'book',book_title:'Book',book_authors:['Author']}} onComments={()=>{}} onVote={()=>{}} onMore={()=>{}} onShare={()=>{}}/>);});expect(view.root.findByType('FeedPostImage').props.uri).toBe('photo.jpg');expect(view.root.findAllByType('BookCoverImage')).toHaveLength(0);expect(allText()).toContain('Author');});

test('opening the whole post can navigate independently from the quick comment button',async()=>{
 const onOpen=jest.fn();const callbacks=await render({onOpen});
 await act(async()=>view.root.findAllByType('Pressable')[0].props.onPress());
 expect(onOpen).toHaveBeenCalledWith(post);expect(callbacks.onComments).not.toHaveBeenCalled();
 const comment=view.root.findAllByType('Pressable').find(b=>b.findAllByType('Icon').length===1&&b.findAllByType('Icon').some(i=>i.props.name==='chatbubble-outline'));
 await act(async()=>comment.props.onPress({stopPropagation:jest.fn()}));expect(callbacks.onComments).toHaveBeenCalledWith(post);expect(onOpen).toHaveBeenCalledTimes(1);
});

test('spoiler posts hide text and photos until revealed and hide again after editing',async()=>{
 const flagged={...post,contains_spoilers:true,updated_at:'v1',post_image_url:'photo.jpg'};
 await render({post:flagged,currentUserId:'reader'});
 expect(allText()).not.toContain('A post');expect(view.root.findAllByType('FeedPostImage')).toHaveLength(0);
 await act(async()=>byLabel('Reveal post spoilers').props.onPress({stopPropagation:jest.fn()}));
 expect(allText()).toContain('A post');expect(view.root.findAllByType('FeedPostImage')).toHaveLength(1);
 await act(async()=>view.update(<FeedPostCard post={{...flagged,updated_at:'v2',body:'Edited spoiler'}} onComments={()=>{}} onVote={()=>{}} onShare={()=>{}}/>));
 expect(allText()).not.toContain('Edited spoiler');expect(view.root.findAllByType('FeedPostImage')).toHaveLength(0);
});
