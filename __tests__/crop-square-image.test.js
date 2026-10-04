import {cropSquareImage} from '../src/lib/crop-square-image';
let mockContext,mockImage;
jest.mock('expo-image-manipulator',()=>({ImageManipulator:{manipulate:()=>mockContext},SaveFormat:{JPEG:'jpeg'}}));
beforeEach(()=>{mockImage={saveAsync:jest.fn(async()=>({uri:'result.jpg'})),release:jest.fn()};mockContext={crop:jest.fn(function(){return this;}),resize:jest.fn(function(){return this;}),renderAsync:jest.fn(async()=>mockImage),release:jest.fn()};});
test('preserves crop, resolution and quality while releasing native resources',async()=>{
 const rect={originX:5,originY:10,width:300,height:300};expect(await cropSquareImage('source.jpg',rect)).toEqual({uri:'result.jpg'});expect(mockContext.crop).toHaveBeenCalledWith(rect);expect(mockContext.resize).toHaveBeenCalledWith({width:1024,height:1024});expect(mockImage.saveAsync).toHaveBeenCalledWith({compress:.9,format:'jpeg'});expect(mockImage.release).toHaveBeenCalledTimes(1);expect(mockContext.release).toHaveBeenCalledTimes(1);
});
test('save failure still releases both native resources',async()=>{mockImage.saveAsync.mockRejectedValue(new Error('disk full'));await expect(cropSquareImage('source.jpg',{originX:0,originY:0,width:300,height:300})).rejects.toThrow('disk full');expect(mockImage.release).toHaveBeenCalledTimes(1);expect(mockContext.release).toHaveBeenCalledTimes(1);});
