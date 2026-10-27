import React from 'react';
import renderer, {act} from 'react-test-renderer';
import CartShortcut from '../src/components/CartShortcut';
const mockPush=jest.fn(), mockRefresh=jest.fn().mockResolvedValue(undefined);
let mockAddition, mockDone, mockReduced=false;
const mockStop=jest.fn();
jest.mock('expo-router',()=>({useRouter:()=>({push:mockPush}),useFocusEffect:callback=>require('react').useEffect(callback,[callback])}));
jest.mock('expo-image',()=>({Image:'ExpoImage'}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('../src/context/theme-context',()=>({useNovoriTheme:()=>({colors:require('../src/constants/novori-theme').DARK_COLORS})}));
jest.mock('../src/lib/book-cart-count',()=>({
 getBookCartCountSnapshot:()=>4,subscribeBookCartCount:()=>()=>{},refreshBookCartCount:()=>mockRefresh(),
 subscribeCartAdditions:callback=>{mockAddition=callback;return()=>{mockAddition=null;};},
}));
jest.mock('react-native',()=>({Platform:{select:values=>values.ios??values.default},View:'View',Text:'Text',Pressable:'Pressable',useWindowDimensions:()=>({width:390,height:844}),
 AccessibilityInfo:{isReduceMotionEnabled:()=>Promise.resolve(mockReduced),addEventListener:()=>({remove:jest.fn()}),announceForAccessibility:jest.fn()},
 Animated:{View:'AnimatedView',Value:class {setValue(){} interpolate(){return 0;}},timing:()=>({}),spring:()=>({}),delay:()=>({}),sequence:()=>({start:done=>{mockDone=done;},stop:mockStop})},
}));
let view;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;jest.clearAllMocks();mockReduced=false;});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;});
async function render(){await act(async()=>{view=renderer.create(<CartShortcut animateAdditions/>,{createNodeMock:()=>({measureInWindow:done=>done(300,80,44,44)})});});}
test('opens the existing cart and shows its shared confirmed count',async()=>{
 await render();const button=view.root.findByType('Pressable');expect(button.props.accessibilityLabel).toBe('Open Book Cart, 4 books');
 await act(async()=>button.props.onPress());expect(mockPush).toHaveBeenCalledWith('/book-cart');expect(mockRefresh).toHaveBeenCalledTimes(1);
});
test('a successful addition uses the existing cover, then cleans up after the animation',async()=>{
 await render();await act(async()=>mockAddition({title:'Book',coverUrl:'https://covers/book.jpg'}));
 expect(view.root.findByType('ExpoImage').props.source).toBe('https://covers/book.jpg');
 await act(async()=>mockDone({finished:true}));expect(view.root.findAllByType('ExpoImage')).toHaveLength(0);
});
test('Reduce Motion confirms the addition without flying a cover',async()=>{
 mockReduced=true;await render();await act(async()=>mockAddition({title:'Book',coverUrl:'https://covers/book.jpg'}));
 expect(view.root.findAllByType('ExpoImage')).toHaveLength(0);
 expect(view.root.findAllByType('Text').some(node=>node.props.children==='Added to Book Cart')).toBe(true);
});
