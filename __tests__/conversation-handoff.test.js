import React from 'react';
import renderer,{act} from 'react-test-renderer';
import ConversationHandoffOverlay from '../src/components/ConversationHandoffOverlay';
import {beginConversationHandoff,conversationDestinationLaidOut,getConversationHandoff} from '../src/lib/conversation-handoff';
jest.mock('react-native',()=>({Platform:{OS:'ios'},View:'View',StyleSheet:{absoluteFill:{position:'absolute',top:0,bottom:0,left:0,right:0}}}));
jest.mock('react-native-screens',()=>({FullWindowOverlay:'FullWindowOverlay'}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:{background:'#faf7ef'}})}));
let view,frames;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;frames=[];global.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};require('react-native').Platform.OS='ios';});
afterEach(async()=>{await act(async()=>{const pending=getConversationHandoff();if(pending){conversationDestinationLaidOut(pending.postId,pending.commentId);frames.splice(0).forEach(callback=>callback());}view?.unmount();});view=null;});
test('the sheet stays intact until the opaque cover lays out, and the Feed stays covered until the matching destination lays out',async()=>{
 const hideSheet=jest.fn();await act(async()=>{view=renderer.create(<ConversationHandoffOverlay/>);beginConversationHandoff('post','comment',hideSheet);});
 expect(hideSheet).not.toHaveBeenCalled();expect(view.root.findAllByType('FullWindowOverlay')).toHaveLength(1);
 const cover=view.root.findByType('View');expect(cover.props.style[1].backgroundColor).toBe('#faf7ef');
 await act(async()=>{cover.props.onLayout();cover.props.onLayout();});expect(hideSheet).toHaveBeenCalledTimes(1);
 await act(async()=>conversationDestinationLaidOut('other-post','comment'));expect(frames).toHaveLength(0);expect(getConversationHandoff()).not.toBeNull();
 await act(async()=>conversationDestinationLaidOut('post','comment'));expect(getConversationHandoff()).not.toBeNull();
 await act(async()=>frames.shift()());expect(getConversationHandoff()).toBeNull();expect(view.toJSON()).toBeNull();
});
test('Android uses an opaque app-root cover with the same layout handshake',async()=>{
 require('react-native').Platform.OS='android';const hideSheet=jest.fn();await act(async()=>{view=renderer.create(<ConversationHandoffOverlay/>);beginConversationHandoff('post','comment',hideSheet);});expect(view.root.findAllByType('FullWindowOverlay')).toHaveLength(0);await act(async()=>view.root.findByType('View').props.onLayout());expect(hideSheet).toHaveBeenCalledTimes(1);
});
test('a late destination frame cannot clear a newer handoff',async()=>{
 beginConversationHandoff('post','first',()=>{});conversationDestinationLaidOut('post','first');beginConversationHandoff('post','second',()=>{});frames.shift()();expect(getConversationHandoff().commentId).toBe('second');
});
