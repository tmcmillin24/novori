jest.mock('../supabase/functions/_shared/book-cover-selector',()=>({selectCanonicalGoogleCoversForWorkIds:jest.fn(async()=>{})}));
import {recordGoogleBooksInCatalog} from '../supabase/functions/_shared/book-catalog';
const book:any={id:'edition-id',source:{provider:'isbndb',isbn13:'9781496764751'},volumeInfo:{title:'An Ordinary Novel',authors:['Another Writer'],industryIdentifiers:[{type:'ISBN_13',identifier:'9781496764751'}],imageLinks:{thumbnail:'https://publisher/cover.jpg'}}};
function db(prior:any){
 const writes:any[]=[];
 const admin:any={from(table:string){const q:any={select(){return q;},eq(){return q;},in(){return q;},upsert(rows:any){if(table==='book_editions')writes.push(...rows);return Promise.resolve({error:null});},then(resolve:any){return Promise.resolve({data:table==='book_works'?[{id:'work-id',work_key:'an ordinary novel::another writer'}]:table==='book_editions'?(prior?[prior]:[]):[],error:null}).then(resolve);}};return q;}};
 return {admin,writes};
}
test('catalog revalidation retains exact-edition pages when later provider metadata omits them',async()=>{
 const {admin,writes}=db({provider_book_id:book.id,detail_complete:true,metadata:{...book,volumeInfo:{...book.volumeInfo,pageCount:480}},page_count:480});
 await recordGoogleBooksInCatalog(admin,{items:[book]},true,'isbndb_lookup','isbndb');
 expect(writes).toHaveLength(1);expect(writes[0].page_count).toBe(480);expect(writes[0].metadata.volumeInfo.pageCount).toBe(480);
 expect(writes[0].metadata.volumeInfo.imageLinks).toEqual(book.volumeInfo.imageLinks);
});
test('catalog never borrows a count from another ISBN and accepts provider numeric strings',async()=>{
 const {admin,writes}=db({provider_book_id:book.id,detail_complete:true,metadata:{...book,source:{isbn13:'9781496764898'}},page_count:999});
 await recordGoogleBooksInCatalog(admin,{items:[book]},true,'isbndb_lookup','isbndb');expect(writes[0].page_count).toBeNull();
 const next=db(null);await recordGoogleBooksInCatalog(next.admin,{items:[{...book,volumeInfo:{...book.volumeInfo,pageCount:'320'}}]},true,'isbndb_lookup','isbndb');expect(next.writes[0].page_count).toBe(320);
});
