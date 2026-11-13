const hosts = new Set(['images.isbndb.com','assets.hardcover.app','books.google.com','books.googleusercontent.com','covers.openlibrary.org']);
export function safeAdminCover(value) {
 try {
  const url=new URL(value);
  if(url.protocol!=='https:'||!hosts.has(url.hostname)||url.port||url.username||url.password||url.hash||url.pathname==='/'||url.href.length>2048) return null;
  if([...url.searchParams.keys()].some(key=>/token|signature|expires|credential|^imgtk$/i.test(key))) return null;
  return url.href;
 } catch {return null;}
}
export function coverOptions(snapshot) {
 const options=new Map();
 function add(url, detail) { const safe=safeAdminCover(url); if(safe&&!options.has(safe)) options.set(safe,{...detail,url:safe}); }
 const editions=new Map((snapshot.editions??[]).map(e=>[e.id,e]));
 for(const edition of editions.values()) {
  const info=edition.metadata?.volumeInfo??{};
  for(const key of ['extraLarge','large','medium','small','thumbnail','smallThumbnail']) add(info.imageLinks?.[key],{
   provider:edition.provider,isbn:edition.isbn_13,title:info.title,authors:info.authors,publisher:info.publisher,publishedDate:info.publishedDate,language:info.language,
  });
 }
 for(const candidate of snapshot.candidates??[]) {
  const edition=editions.get(candidate.edition_id),info=edition?.metadata?.volumeInfo??{};
  add(candidate.url,{provider:candidate.provider,isbn:edition?.isbn_13,title:info.title,publisher:info.publisher,publishedDate:info.publishedDate,language:info.language});
 }
 return [...options.values()];
}
