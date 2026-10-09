import { editionIsbn, validPageCount } from '../../supabase/functions/_shared/edition-pages';
import { audioEditionPenalty } from '../../supabase/functions/_shared/book-edition-metadata';
const counts = new Map<string,{isbn:string;pageCount:number}>();
const listeners = new Set<()=>void>();
export function rememberEditionPages(facts: Record<string,{isbn:string;pageCount:number}>) {
 let changed = false;
 for (const [id,fact] of Object.entries(facts)) {
  if (!/^(978|979)\d{10}$/.test(fact?.isbn ?? '') || !validPageCount(fact.pageCount)) continue;
  if (JSON.stringify(counts.get(id)) === JSON.stringify(fact)) continue;
  counts.delete(id); counts.set(id,fact); changed = true;
 }
 while (counts.size > 300) counts.delete(counts.keys().next().value!);
 if (changed) listeners.forEach(listener=>listener());
}
export function subscribeEditionPages(listener:()=>void) { listeners.add(listener); return ()=>{listeners.delete(listener);}; }
export function applyEditionPages<T extends {id:string;volumeInfo:any}>(book:T):T {
 const known = counts.get(book.id);
 if (!known || audioEditionPenalty(book)) return book;
 const isbn=editionIsbn(book);
 if (isbn && known.isbn !== isbn) return book;
 // Facts for identifier-less legacy details come from this exact stored book ID.
 if (!isbn) return {...book,volumeInfo:{...book.volumeInfo,pageCount:known.pageCount,industryIdentifiers:[...(Array.isArray(book.volumeInfo.industryIdentifiers)?book.volumeInfo.industryIdentifiers:[]),{type:'ISBN_13',identifier:known.isbn}]}};
 return {...book,volumeInfo:{...book.volumeInfo,pageCount:known.pageCount}};
}
