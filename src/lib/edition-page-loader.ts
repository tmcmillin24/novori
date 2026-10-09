import { supabase } from './supabase';
import { createBookReadCache } from './book-read-cache';
import { rememberEditionPages } from './edition-pages';
import { editionIsbn } from '../../supabase/functions/_shared/edition-pages';
import { audioEditionPenalty } from '../../supabase/functions/_shared/book-edition-metadata';

const failedUntil=new Map<string,number>();
const readPages=createBookReadCache<Record<string,{isbn:string;pageCount:number}>>(6*3600000,300);
export async function syncEditionPages(book:{id:string;volumeInfo:any}) {
 if(!editionIsbn(book) || audioEditionPenalty(book))return;
 if((failedUntil.get(book.id) ?? 0)>Date.now())return;
 const facts=await readPages(book.id,async()=>{
  const {data,error}=await supabase.functions.invoke('book-edition-pages',{body:{volumeId:book.id}});
  if(error || data?.ok!==true)throw new Error('Page lookup unavailable.');
  return data.pageCounts ?? {};
 }).catch(error=>{
  failedUntil.delete(book.id);failedUntil.set(book.id,Date.now()+60000);
  while(failedUntil.size>300)failedUntil.delete(failedUntil.keys().next().value!);
  throw error;
 });
 failedUntil.delete(book.id);
 rememberEditionPages(facts);
}
