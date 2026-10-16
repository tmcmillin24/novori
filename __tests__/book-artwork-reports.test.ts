import {submitBookArtworkReport} from '../src/lib/reports';
import {supabase} from '../src/lib/supabase';
jest.mock('../src/lib/supabase',()=>({supabase:{rpc:jest.fn()}}));
const rpc=supabase.rpc as jest.Mock;
beforeEach(()=>rpc.mockReset());
test('reports the existing book identity and displayed cover without catalog/provider writes',async()=>{
 rpc.mockResolvedValue({data:'report-id',error:null});
 expect(await submitBookArtworkReport('nv_9781408884430','blurry_cover','https://example.com/cover.jpg')).toBe('report-id');
 expect(rpc).toHaveBeenCalledTimes(1);
 expect(rpc).toHaveBeenCalledWith('submit_book_artwork_report',{p_book_id:'nv_9781408884430',p_reason:'blurry_cover',p_cover_url:'https://example.com/cover.jpg'});
});
test('missing cover can be reported and server errors never announce success',async()=>{
 rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});
 await expect(submitBookArtworkReport('nv_1','missing_cover',null)).rejects.toThrow('not available on this server yet');
 rpc.mockResolvedValue({data:null,error:{code:'42501',message:'Sign in with an active account'}});
 await expect(submitBookArtworkReport('nv_1','wrong_cover',null)).rejects.toThrow('Sign in');
});
