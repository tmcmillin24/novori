// Read public catalog records only. Never print credentials or reader data.
const token=process.env.SUPABASE_ACCESS_TOKEN;
const project=process.env.NOVORI_SUPABASE_PROJECT_REF ?? 'oanpmuiuuwljknwvyzev';
const title=process.argv.slice(2).join(' ').trim();
if(!token || !title || title.length>200){console.error('Export your copied CLI token, then provide the book title.');process.exit(1);}
const wanted=title.replace(/'/g,"''").replace(/[\\%_]/g,' ');
const query=`with matches as (
 select e.id,e.work_id,e.provider,e.provider_book_id,e.isbn_13,e.detail_complete,e.metadata
 from public.book_editions e
 where e.provider in ('isbndb','google_books') and e.metadata#>>'{volumeInfo,title}' ilike '%${wanted}%'
), works as (select distinct work_id from matches)
select jsonb_build_object(
 'editions',coalesce((select jsonb_agg(jsonb_build_object('book_id',m.provider_book_id,'provider',m.provider,'isbn',m.isbn_13,'complete',m.detail_complete,'title',m.metadata#>'{volumeInfo,title}','authors',m.metadata#>'{volumeInfo,authors}','language',m.metadata#>'{volumeInfo,language}','images',m.metadata#>'{volumeInfo,imageLinks}','format',m.metadata#>'{novoriEdition,format}')) from matches m),'[]'::jsonb),
 'candidates',coalesce((select jsonb_agg(jsonb_build_object('provider',c.provider,'variant',c.source_variant,'url',c.url,'proof',c.source_metadata)) from public.book_cover_candidates c where c.work_id in (select work_id from works)),'[]'::jsonb),
 'cached_search',coalesce((select jsonb_agg(jsonb_build_object('key',s.request_key,'expires',s.expires_at,'items',(select jsonb_agg(jsonb_build_object('id',b->>'id','isbn',b#>'{source,isbn13}','title',b#>'{volumeInfo,title}','authors',b#>'{volumeInfo,authors}','language',b#>'{volumeInfo,language}','images',b#>'{volumeInfo,imageLinks}')) from jsonb_array_elements(case when jsonb_typeof(s.response_json->'items')='array' then s.response_json->'items' else '[]'::jsonb end) b where b#>>'{volumeInfo,title}' ilike '%${wanted}%'))) from public.book_api_cache s where s.provider='isbndb' and s.request_key like 'search:%' and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(s.response_json->'items')='array' then s.response_json->'items' else '[]'::jsonb end) b where b#>>'{volumeInfo,title}' ilike '%${wanted}%')),'[]'::jsonb)
) as artwork_diagnostic;`;
const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:true})});
if(!response.ok){console.error(`Artwork diagnostic failed (${response.status}): ${await response.text()}`);process.exit(1);}
console.log(JSON.stringify(await response.json(),null,2));
