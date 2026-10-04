import {ImageManipulator,SaveFormat,type ImageRef} from 'expo-image-manipulator';

/** Preserve Novori's crop geometry and output quality with the current contextual API. */
export async function cropSquareImage(uri:string,rect:{originX:number;originY:number;width:number;height:number}){
  const context=ImageManipulator.manipulate(uri);
  let rendered:ImageRef|undefined;
  try{
    context.crop(rect).resize({width:1024,height:1024});
    rendered=await context.renderAsync();
    return await rendered.saveAsync({compress:0.9,format:SaveFormat.JPEG});
  }finally{
    rendered?.release();context.release();
  }
}
