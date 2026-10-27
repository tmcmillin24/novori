import React from 'react';
import renderer,{act} from 'react-test-renderer';
import CachedMediaImage from '../src/components/CachedMediaImage';
jest.mock('expo-image',()=>({Image:'ExpoImage'}));
let view;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;process.env.EXPO_PUBLIC_MODERATION_MEDIA_ORIGIN='https://media.novori.link';});
afterEach(async()=>{if(view)await act(async()=>view.unmount());view=null;delete process.env.EXPO_PUBLIC_MODERATION_MEDIA_ORIGIN;});
test('shares public photo cache entries while adapting the native image load event',async()=>{
 const onLoad=jest.fn();
 await act(async()=>{view=renderer.create(<CachedMediaImage source={{uri:'https://media.novori.link/post-media/a/photo.jpg'}} resizeMode="contain" onLoad={onLoad}/>);});
 const image=view.root.findByType('ExpoImage');expect(image.props.cachePolicy).toBe('memory-disk');expect(image.props.contentFit).toBe('contain');expect(image.props.transition).toBe(0);
 await act(async()=>image.props.onLoad({source:{width:300,height:500,url:'photo.jpg'}}));expect(onLoad.mock.calls[0][0].nativeEvent.source.height).toBe(500);
 await act(async()=>view.update(<CachedMediaImage source={{uri:'https://media.novori.link/post-media/a/new.jpg'}}/>));
 expect(view.root.findByType('ExpoImage').props.recyclingKey).toContain('/new.jpg');
});
