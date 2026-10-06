import React from 'react';
import renderer,{act} from 'react-test-renderer';
import ValidationWarningSheet from '../src/components/ValidationWarningSheet';
jest.mock('react-native',()=>({View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:x=>x,absoluteFill:{position:'absolute',top:0,left:0,right:0,bottom:0},absoluteFillObject:{position:'absolute',top:0,left:0,right:0,bottom:0}}}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({bottom:0})}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:{gold:'#ab832f'}})}));
jest.mock('../src/components/UiSheet',()=>({useUiSheetMotion:()=>({close:jest.fn(),sheetStyle:{opacity:0,transform:[{translateY:999}]}}),UiSheetModal:'Modal',UiSheetSurface:'AnimatedSurface',UiSheetBackdrop:'AnimatedBackdrop'}));
let view;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;});
afterEach(async()=>{await act(async()=>view?.unmount());});
test.each(['New comment needs review','Edited comment is waiting for review'])('embedded warning is visible without animation callbacks: %s',async message=>{
 const dismiss=jest.fn();await act(async()=>{view=renderer.create(<ValidationWarningSheet embedded visible title="Submission under review" message={message} onDismiss={dismiss}/>);});
 expect(view.root.findAllByType('Text').some(n=>n.props.children===message)).toBe(true);
 expect(view.root.findAllByType('AnimatedSurface')).toHaveLength(0);
 expect(view.root.findAllByType('Modal')).toHaveLength(0);
 const button=view.root.findAllByType('Pressable').find(n=>n.props.accessibilityRole==='button');
 await act(async()=>button.props.onPress());expect(dismiss).toHaveBeenCalledTimes(1);
});
test('hidden embedded warning renders no message',async()=>{
 await act(async()=>{view=renderer.create(<ValidationWarningSheet embedded visible={false} title="Review" message="Hidden" onDismiss={()=>{}}/>);});expect(view.toJSON()).toBeNull();
});
