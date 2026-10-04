import {openCommentConversation,hideCommentSheetForNavigation} from '../src/lib/open-comment-conversation';
import {Keyboard} from 'react-native';
jest.mock('react-native',()=>({Keyboard:{dismiss:jest.fn()},Platform:{OS:'ios',select:value=>value.ios??value.default},TurboModuleRegistry:{get:()=>null}}));
beforeEach(()=>jest.clearAllMocks());
test('sheet entry freezes movement and hides immediately without closing animation or keyboard movement',()=>{
 const push=jest.fn(),stopMotion=jest.fn(),suspend=jest.fn();openCommentConversation(push,'post','comment',{stopMotion,suspend});expect(stopMotion).toHaveBeenCalledTimes(1);expect(suspend).toHaveBeenCalledTimes(1);expect(stopMotion.mock.invocationCallOrder[0]).toBeLessThan(suspend.mock.invocationCallOrder[0]);expect(Keyboard.dismiss).not.toHaveBeenCalled();expect(push).not.toHaveBeenCalled();suspend.mock.calls[0][0]();expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);expect(push).toHaveBeenCalledWith({pathname:'/post/[id]/conversation',params:{id:'post',threadId:'comment',commentId:'comment'}});
});
test('full post and nested conversation entries navigate directly to the same destination',()=>{
 const push=jest.fn();openCommentConversation(push,'post','comment');expect(push).toHaveBeenCalledWith({pathname:'/post/[id]/conversation',params:{id:'post',threadId:'comment',commentId:'comment'}});expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
});

test('the native sheet is invisible before stopping motion can produce a shorter layout',()=>{
 let opacity=1;const visibleLayouts=[];const view={setNativeProps:jest.fn(props=>{opacity=props.style.opacity;})};hideCommentSheetForNavigation(view,()=>{if(opacity>0)visibleLayouts.push('collapsed sheet');});expect(view.setNativeProps).toHaveBeenCalledWith({style:{opacity:0}});expect(visibleLayouts).toEqual([]);
});
