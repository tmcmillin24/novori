const mockResolve = jest.fn().mockResolvedValue(null);
let mockRows: any[]=[];
jest.mock('../src/lib/canonical-book-covers',()=>({resolveCanonicalBookCover:(...args:unknown[])=>mockResolve(...args)}));
jest.mock('../src/lib/supabase',()=>({supabase:{
 auth:{getUser:async()=>({data:{user:{id:'reader'}},error:null})},
 from:()=>{
  let bookId:string|null=null, update:any=null, insert:any=null;
  const query:any={
   select:()=>query,
   eq:(key:string,value:string)=>{if(key==='google_book_id')bookId=value;return query;},
   order:async()=>({data:mockRows,error:null}),
   maybeSingle:async()=>({data:mockRows.find(row=>row.google_book_id===bookId)??null,error:null}),
   update:(value:any)=>{update=value;return query;},
   insert:(value:any)=>{insert=value;return query;},
   single:async()=>{
    if(insert){const row={id:'entry',rating:null,review_text:null,...insert};mockRows.push(row);return{data:row,error:null};}
    const index=mockRows.findIndex(row=>row.google_book_id===bookId);
    mockRows[index]={...mockRows[index],...update};return{data:mockRows[index],error:null};
   },
  };return query;
 },
}}));
import {getUserBooks,saveUserBook,updateUserBookOwned} from '../src/lib/user-books';
beforeEach(()=>{mockResolve.mockClear();});
test('library reads hide empty unowned rows before any cover lookup, preserving owned/status/history entries',async()=>{
 const base={user_id:'reader',status:null,owned:false,rating:null,review_text:null,started_at:null,finished_at:null,dnf_at:null};
 mockRows=[{...base,google_book_id:'empty'},{...base,google_book_id:'owned',owned:true},{...base,google_book_id:'tbr',status:'want_to_read'},{...base,google_book_id:'history',started_at:'2026-10-27'}];
 expect((await getUserBooks()).map(book=>book.google_book_id)).toEqual(['owned','tbr','history']);
 expect(mockResolve.mock.calls.map(args=>args[0].googleBookId)).toEqual(['owned','tbr','history']);
});

test('cart Owned -> book page unowned removes ownership-only membership without deleting its record',async()=>{
 mockRows=[];
 await saveUserBook({googleBookId:'cart-book',title:'Book',status:null,owned:true});
 expect((await getUserBooks()).map(book=>book.google_book_id)).toEqual(['cart-book']);
 await updateUserBookOwned('cart-book',false);
 expect(await getUserBooks()).toEqual([]);
 expect(mockRows).toHaveLength(1);expect(mockRows[0].owned).toBe(false);
});
