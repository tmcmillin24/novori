const fs=require('fs'),path=require('path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261009160000_edition_pages_recap.sql'),'utf8');
test('page persistence is exact edition, backend-only, and preserves catalog source age and artwork',()=>{
 const store=sql.slice(sql.indexOf('create or replace function public.novori_store_edition_pages'),sql.indexOf('-- Repair existing cached counts'));
 expect(store).toContain('e.provider_book_id=p_book_id and e.isbn_13=p_isbn');
 expect(store).toContain("metadata=jsonb_set(e.metadata,'{volumeInfo,pageCount}'");
 expect(store).not.toMatch(/set\s+(?:fetched_at|cover_url|metadata\s*=\s*to_jsonb)/i);
 expect(store).not.toContain('imageLinks');
 expect(store).toContain('from public,anon,authenticated');
 expect(store).toContain('to service_role');
});
test('yearly totals include ISBNdb, preserve completion and reread rules, and do not touch shared snapshots',()=>{
 const totals=sql.slice(sql.indexOf('create or replace function public.get_finished_book_page_totals'));
 expect(totals).toContain("e.provider in ('isbndb','google_books')");
 expect(totals).toContain('e.provider_book_id=b.google_book_id');
 expect(totals).toContain('union all');expect(totals).toContain("s.journey_status='finished'");
 expect(totals).toContain('not exists(select 1 from public.reading_sessions');
 expect(totals).toContain('auth.uid()');expect(totals).toContain('at time zone reader_timezone');
 expect(sql).not.toMatch(/update\s+public\.(?:posts|reading_sessions|user_books)/i);
 expect(sql).toContain("'9781496764751'");expect(sql).not.toContain('9781496764898');
});
