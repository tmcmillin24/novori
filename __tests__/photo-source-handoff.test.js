import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Platform} from 'react-native';
import PhotoSourceSheet from '../src/components/PhotoSourceSheet';
jest.mock('react-native',()=>({Platform:{OS:'ios'},Modal:'Modal',View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:x=>x,absoluteFill:{}}}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView',useSafeAreaInsets:()=>({bottom:0})}));
jest.mock('../src/components/UiSheet',()=>require('./helpers/ui-sheet-mock.cjs'));
let view;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;Platform.OS='ios';});
afterEach(async()=>{await act(async()=>view?.unmount());});
async function mount(){
 const library=jest.fn(),camera=jest.fn();
 function Harness(){const [visible,setVisible]=React.useState(true);return <PhotoSourceSheet visible={visible} title="Add Photo" colors={{}} onClose={()=>setVisible(false)} onChooseLibrary={library} onTakePhoto={camera}/>;}
 await act(async()=>{view=renderer.create(<Harness/>);});return {library,camera};
}
test.each([['Choose from Library','library'],['Take Photo','camera']])('iOS waits for native dismissal before %s',async(label,key)=>{
 const actions=await mount();
 const button=view.root.findAllByType('Pressable').filter(node=>node.findAllByType('Text').some(text=>text.props.children===label)).pop();
 await act(async()=>button.props.onPress());
 expect(view.root.findByType('Modal').props.visible).toBe(false);
 expect(actions[key]).not.toHaveBeenCalled();
 await act(async()=>view.root.findByType('Modal').props.onDismiss());
 expect(actions[key]).toHaveBeenCalledTimes(1);
 await act(async()=>view.root.findByType('Modal').props.onDismiss());
 expect(actions[key]).toHaveBeenCalledTimes(1);
});
test('Android opens library after hiding the sheet without an iOS-only callback',async()=>{
 Platform.OS='android';const {library}=await mount();
 const button=view.root.findAllByType('Pressable').filter(node=>node.findAllByType('Text').some(text=>text.props.children==='Choose from Library')).pop();
 await act(async()=>button.props.onPress());
 expect(view.root.findByType('Modal').props.visible).toBe(false);expect(library).toHaveBeenCalledTimes(1);
});
