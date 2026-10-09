import {resolveEditionPageCount,hardcoverPageFact} from '../supabase/functions/_shared/edition-page-resolver';
import {cachedHardcoverFetch,cachedProviderValue} from '../supabase/functions/_shared/provider-cache';
jest.mock('../supabase/functions/_shared/provider-cache',()=>({cachedHardcoverFetch:jest.fn(),cachedProviderValue:jest.fn(async(options:any)=>options.load())}));
const metadata={id:'nv_9781496764751',source:{provider:'isbndb',isbn13:'9781496764751'},volumeInfo:{title:'A Fate So Dark and Delicate',authors:['Sophia St. Germain'],industryIdentifiers:[{type:'ISBN_13',identifier:'9781496764751'}]}};
const edition={isbn_13:'9781496764751',pages:480,reading_format:{format:'physical'},book:{title:metadata.volumeInfo.title,contributions:[{author:{name:'Sophia St. Germain'}}]}};
const row={provider_book_id:metadata.id,metadata};
function db(pages?:number,publisher=false){return{rpc:jest.fn(async(..._args:any[])=>({data:pages ?? 480,error:null})),from(table:string){const data=table==='book_edition_page_facts' && publisher?[{isbn_13:'9781496764751',title:metadata.volumeInfo.title,authors:metadata.volumeInfo.authors,page_count:480}]:[];const q:any={select(){return q;},eq(){return q;},in(){return q;},gt(){return q;},then(resolve:any){return Promise.resolve({data,error:null}).then(resolve);}};return q;}};}
beforeEach(()=>{jest.clearAllMocks();(cachedProviderValue as jest.Mock).mockImplementation(async(options:any)=>options.load());(cachedHardcoverFetch as jest.Mock).mockImplementation(async()=>({json:async()=>({data:{editions:[edition]}})}));});
test('valid ISBNdb pages require no Hardcover request and are persisted for recaps',async()=>{
 const admin=db(416);const result=await resolveEditionPageCount(admin,{...row,metadata:{...metadata,volumeInfo:{...metadata.volumeInfo,pageCount:416}}},'token');
 expect(result).toEqual({isbn:'9781496764751',pageCount:416});expect(cachedHardcoverFetch).not.toHaveBeenCalled();expect(admin.rpc).toHaveBeenCalledWith('novori_store_edition_pages',{p_book_id:metadata.id,p_isbn:'9781496764751',p_page_count:416});
});
test('publisher verified paperback pages fill a missing count without using ebook artwork or calling providers',async()=>{
 const admin=db(undefined,true);expect((await resolveEditionPageCount(admin,row,'token'))?.pageCount).toBe(480);expect(cachedHardcoverFetch).not.toHaveBeenCalled();
 expect(admin.rpc.mock.calls[0][0]).toBe('novori_store_edition_pages');expect(admin.rpc).toHaveBeenCalledTimes(1);
});
test('missing counts use exactly one cached Hardcover exact-ISBN request; failed persistence is not reported as success',async()=>{
 const admin=db();expect((await resolveEditionPageCount(admin,row,'token'))?.pageCount).toBe(480);expect(cachedHardcoverFetch).toHaveBeenCalledTimes(1);
 const options=(cachedProviderValue as jest.Mock).mock.calls[0][0];expect(options.key).toBe('page-lookup:v1:9781496764751');expect(options.valueLifetime(null).freshMs).toBe(6*3600000);
 expect(JSON.parse((cachedHardcoverFetch as jest.Mock).mock.calls[0][2].body).variables).toEqual({isbn:'9781496764751'});
 admin.rpc.mockResolvedValue({data:null as any,error:Error('offline') as any});await expect(resolveEditionPageCount(admin,row,'token')).rejects.toThrow('persist');
});
test('other ISBNs, audio, wrong authors, wrong titles and cached identity conflicts cannot lend pages',async()=>{
 for(const changed of [{isbn_13:'9781496764898'},{reading_format:{format:'audio'}},{book:{...edition.book,title:'Study Guide'}},{book:{...edition.book,contributions:[{author:{name:'Other Writer'}}]}}])expect(hardcoverPageFact(metadata,[{...edition,...changed}])).toBeNull();
 (cachedProviderValue as jest.Mock).mockResolvedValue({source:{isbn13:'9781496764751'},volumeInfo:{title:'Other Novel',authors:['Other Writer'],pageCount:480}});
 const admin=db();expect(await resolveEditionPageCount(admin,row,'token')).toBeNull();expect(admin.rpc).not.toHaveBeenCalled();
});

test('missing reading-format labels do not discard verified exact-ISBN pages; explicit audio still does',()=>{
 expect(hardcoverPageFact(metadata,[{...edition,reading_format:null}])).toBe(480);
 expect(hardcoverPageFact(metadata,[{...edition,reading_format:null,audio_seconds:120}])).toBeNull();
});
