import { attachDiscoveryCatalogCovers } from '../supabase/functions/_shared/discovery-cover-catalog';

test('trending rejects an unrelated ISBN edition and uses the verified English work cover', async () => {
 const right = { provider_book_id: 'isbndb_correct', work_id: 'novel', isbn_13: '9781111111111', metadata: { volumeInfo: { title: 'Threshing Day (Standard Edition)', authors: ['Rebecca Yarros'], language: 'en', imageLinks: { thumbnail: 'https://covers/edition.jpg' } } } };
 const wrong = { ...right, provider_book_id: 'wrong', work_id: 'cartoon', isbn_13: '9780349451428', metadata: { volumeInfo: { title: 'Les Dragons', authors: ['Someone Else'], language: 'en' } } };
 const calls: string[] = [];
 const tables: Record<string,any[]> = {book_editions:[{...right,provider:'isbndb',id:'right'},{...wrong,provider:'isbndb',id:'wrong'}],book_works:[{id:'novel',normalized_title:'threshing day'}],book_cover_selections:[],book_cover_candidates:[]};
 const admin: any = { from(table: string) {
  let data=tables[table]??[];
  const q:any={select:()=>q,order:()=>q,range:(a:number,b:number)=>{data=data.slice(a,b+1);return q;},
   eq:(column:string,value:any)=>{data=data.filter(row=>row[column]===value);return q;},
   in:(column:string,values:any[])=>{calls.push(`${table}.${column}`);data=data.filter(row=>values.includes(row[column]));return q;},
   then:(resolve:any)=>Promise.resolve({data,error:null}).then(resolve)};return q;
 }};
 const payload = { books: [{ title: 'Threshing Day', authors: ['Rebecca Yarros'], isbns: ['9780349451428'], coverUrl: 'https://covers/cartoon.jpg' }] };
 const result = await attachDiscoveryCatalogCovers(admin, payload);
 expect(result.books[0]).toMatchObject({ coverBookId: 'isbndb_correct', coverUrl: 'https://covers/edition.jpg' });
 expect(payload.books[0].coverUrl).toBe('https://covers/cartoon.jpg');
 expect(calls).toContain('book_editions.provider_book_id');
});


test('an unresolved discovery listing cannot retain an unverified photographed cover', async () => {
 const admin: any = { from() { const q: any = { select: () => q, eq: () => q, in: () => q,
  then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve) }; return q; } };
 const result = await attachDiscoveryCatalogCovers(admin, { books: [{ title: 'Unknown Book', authors: ['Writer'], isbns: [], coverUrl: 'https://photos/angled.jpg' }] });
 expect(result.books[0].coverUrl).toBeNull();
});
