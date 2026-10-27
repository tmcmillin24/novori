const mockChanged=jest.fn(),mockWrite=jest.fn();
jest.mock('../src/lib/book-cart-count',()=>({bookCartDidChange:(...args:unknown[])=>mockChanged(...args),rememberBookCartCount:jest.fn()}));
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:'reader'}},error:null})},from:()=>({upsert:()=>({select:()=>({single:()=>mockWrite()})})})}}));
import {addBookToCart} from '../src/lib/book-cart';
beforeEach(()=>{jest.clearAllMocks();});
test('a failed save never triggers a cart confirmation or success animation',async()=>{
 mockWrite.mockResolvedValue({data:null,error:new Error('offline')});
 await expect(addBookToCart({googleBookId:'book',title:'Book'})).rejects.toThrow('offline');expect(mockChanged).not.toHaveBeenCalled();
});
test('a confirmed save forwards the existing artwork without resolving a new cover',async()=>{
 mockWrite.mockResolvedValue({data:{id:'item'},error:null});
 await addBookToCart({googleBookId:'book',title:'Book',coverUrl:'https://covers/existing.jpg'});
 expect(mockChanged).toHaveBeenCalledWith('reader','book',{title:'Book',coverUrl:'https://covers/existing.jpg'});
});
