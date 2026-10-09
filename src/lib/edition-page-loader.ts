import { supabase } from './supabase';
import { createBookReadCache } from './book-read-cache';
import { rememberEditionPages } from './edition-pages';
import { editionIsbn, validPageCount } from '../../supabase/functions/_shared/edition-pages';
import { audioEditionPenalty } from '../../supabase/functions/_shared/book-edition-metadata';

const failedUntil=new Map<string,number>();
const readPages=createBookReadCache<Record<string,{isbn:string;pageCount:number}>>(6*3600000,300);
export async function syncEditionPages(book:{id:string;volumeInfo:any}) {
 if(!/^[A-Za-z0-9_-]{1,200}$/.test(book.id) || audioEditionPenalty(book))return;
 const key=`${book.id}:${editionIsbn(book) ?? 'stored-edition'}`;
 if((failedUntil.get(key) ?? 0)>Date.now())return;
 const facts=await readPages(key,async()=>{
  const {data,error}=await supabase.functions.invoke('book-edition-pages',{body:{volumeId:book.id}});
  if(error || data?.ok!==true)throw new Error('Page lookup unavailable.');
  const facts=data.pageCounts ?? {};
  if(!validPageCount(facts[book.id]?.pageCount))throw new Error('Edition pages are not available yet.');
  return facts;
 },facts=>Boolean(validPageCount(facts[book.id]?.pageCount))).catch(error=>{
  failedUntil.delete(key);failedUntil.set(key,Date.now()+60000);
  while(failedUntil.size>300)failedUntil.delete(failedUntil.keys().next().value!);
  throw error;
 });
 failedUntil.delete(key);
 rememberEditionPages(facts);
}
