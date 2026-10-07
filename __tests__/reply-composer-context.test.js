import React from 'react';
import renderer,{act} from 'react-test-renderer';
import ReplyComposerContext from '../src/components/ReplyComposerContext';
jest.mock('react-native',()=>({Platform:{OS:'ios',select:v=>v.ios??v.default},TurboModuleRegistry:{get:()=>null},Pressable:'Pressable',View:'View',Text:'Text',StyleSheet:{create:v=>v}}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').DARK_COLORS})}));
let view,silence;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;silence=jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(async()=>{if(view)await act(async()=>view.unmount());silence.mockRestore();});
test('reply context quotes the selected comment with an emphasized label and cancellation',async()=>{
 const onCancel=jest.fn();await act(async()=>{view=renderer.create(<ReplyComposerContext name="Reader" body="The selected comment" onCancel={onCancel}/>);});
 const texts=view.root.findAllByType('Text');expect(texts[0].props.children.join('')).toBe('Replying to Reader');expect(texts[0].props.style[0].fontFamily).toBe('Inter_600SemiBold');expect(texts[1].props.children).toBe('The selected comment');expect(texts[1].props.numberOfLines).toBe(2);
 await act(async()=>view.root.findByType('Pressable').props.onPress());expect(onCancel).toHaveBeenCalledTimes(1);
});
test('a filtered preview respects language preferences and a focused thread has no temporary cancel control',async()=>{
 await act(async()=>{view=renderer.create(<ReplyComposerContext name="Reader" body="Filtered original" hideBody/>);});
 expect(view.root.findAllByType('Text')[1].props.children).toBe('Comment hidden by your language preference.');expect(view.root.findAllByType('Pressable')).toHaveLength(0);
});
