import {syncEditionPages} from '../src/lib/edition-page-loader';
import {applyEditionPages} from '../src/lib/edition-pages';
import {supabase} from '../src/lib/supabase';
jest.mock('../src/lib/supabase',()=>({supabase:{functions:{invoke:jest.fn()}}}));
const book:any={id:'missing-pages-loader',source:{isbn13:'9781496764751'},volumeInfo:{title:'A Fate So Dark and Delicate',authors:['Sophia St. Germain']}};
test('exact edition synchronization stays in the background and coalesces overlapping and repeated opens',async()=>{
 (supabase.functions.invoke as jest.Mock).mockResolvedValue({data:{ok:true,pageCounts:{[book.id]:{isbn:'9781496764751',pageCount:480}}}});
 await Promise.all([syncEditionPages(book),syncEditionPages(book)]);await syncEditionPages(book);
 expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);expect(applyEditionPages(book).volumeInfo.pageCount).toBe(480);
 await syncEditionPages({...book,id:book.id,volumeInfo:{...book.volumeInfo,pageCount:480}});
 expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});

test('legacy details without display ISBN use the stored edition and empty results retry after short backoff',async()=>{
 const legacy={id:'legacy-page-id',volumeInfo:{title:'Another Novel',authors:['Another Author']}};
 (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({data:{ok:true,pageCounts:{}}});
 await expect(syncEditionPages(legacy)).rejects.toThrow('not available');
 const spy=jest.spyOn(Date,'now').mockReturnValue(Date.now()+61000);
 (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({data:{ok:true,pageCounts:{[legacy.id]:{isbn:'9781496764751',pageCount:480}}}});
 await syncEditionPages(legacy);
 expect(applyEditionPages(legacy).volumeInfo.pageCount).toBe(480);
 spy.mockRestore();
});
