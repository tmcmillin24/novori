import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {useCommentSheetContinuation} from '../src/lib/use-comment-sheet-continuation';
import CommentBranchGuide from '../src/components/CommentBranchGuide';
let mockFocus;
jest.mock('expo-router',()=>({useFocusEffect:callback=>{mockFocus=callback;}}));
jest.mock('react-native',()=>({Platform:{OS:'ios'},View:'View',StyleSheet:{create:value=>value}}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:{gold:'#b9975b'}})}));
let view,api;const setVisible=jest.fn();const scrollTo=jest.fn();const scroll={current:{scrollTo}};
function Harness(){api=useCommentSheetContinuation(setVisible,scroll);return null;}
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;global.requestAnimationFrame=callback=>{callback();return 1;};jest.clearAllMocks();require('react-native').Platform.OS='ios';});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;});
test('iOS suspends without navigating until dismissal, then restores the sheet and exact offset on Back',async()=>{
 await act(async()=>{view=renderer.create(<Harness/>);});mockFocus();api.onScroll(372);const navigate=jest.fn();api.suspend(navigate);expect(setVisible).toHaveBeenLastCalledWith(false);expect(navigate).not.toHaveBeenCalled();expect(api.onDismiss()).toBe(true);expect(navigate).toHaveBeenCalledTimes(1);api.onDismiss();expect(navigate).toHaveBeenCalledTimes(1);mockFocus();expect(setVisible).toHaveBeenLastCalledWith(true);expect(api.onShow()).toBe(true);expect(scrollTo).toHaveBeenCalledWith({y:372,animated:false});expect(api.onDismiss()).toBe(false);
});
test('Android navigates without requiring an iOS dismissal event and reopens on focus',async()=>{
 require('react-native').Platform.OS='android';await act(async()=>{view=renderer.create(<Harness/>);});const navigate=jest.fn();api.suspend(navigate);expect(navigate).toHaveBeenCalledTimes(1);mockFocus();expect(setVisible).toHaveBeenLastCalledWith(true);api.onShow();expect(scrollTo).toHaveBeenCalledWith({y:0,animated:false});
});
test('a new sheet resets the saved offset and normal dismissal keeps its normal cleanup',async()=>{
 await act(async()=>{view=renderer.create(<Harness/>);});api.onScroll(400);api.reset();expect(api.onDismiss()).toBe(false);api.suspend(()=>{});api.onDismiss();mockFocus();api.onShow();expect(scrollTo).toHaveBeenCalledWith({y:0,animated:false});
});
test('tiny dots repeat down the measured branch without becoming a solid line',async()=>{
 await act(async()=>{view=renderer.create(<CommentBranchGuide/>);});const rail=view.root.findAllByType('View')[0];await act(async()=>rail.props.onLayout({nativeEvent:{layout:{height:45}}}));const dots=view.root.findAllByType('View').slice(1);expect(dots).toHaveLength(5);expect(dots.map(dot=>Object.assign({},...dot.props.style).top)).toEqual([0,9,18,27,36]);expect(Object.assign({},...dots[0].props.style)).toMatchObject({width:2,height:2,borderRadius:1});expect(rail.props.pointerEvents).toBe('none');
});
