import { hardcoverDiscoveryEligible } from '../supabase/functions/_shared/hardcover-discovery-policy';
import { verifiedEnglishSeriesArt } from '../supabase/functions/_shared/verified-series-covers';
import { normalizeBookGenres } from '../supabase/functions/_shared/book-genres';
const edition={id:1,title:'A Novel',language:{code2:'en'},isbn_13:'9781234567897',image:{url:'https://assets.hardcover.app/good.jpg'},reading_format:{format:'Physical Book'},release_date:'2023-01-01'};
test('Hardcover default English cover beats an earlier printing without accepting foreign or audiobook artwork',()=>{
 const old={...edition,id:2,image:{url:'https://art/old.jpg'},release_date:'1998-01-01'};
 expect(verifiedEnglishSeriesArt({title:edition.title,default_cover_edition:edition,editions:[old,edition]},true)?.url).toBe(edition.image.url);
 expect(verifiedEnglishSeriesArt({title:edition.title,default_cover_edition:{...edition,language:{code2:'es'}},editions:[old]},true)?.url).toBe(old.image.url);
});
test('audio-only, unknown formats and future-only text editions cannot populate Discover feeds',()=>{
 for(const e of [{...edition,reading_format:{format:'Audiobook'},audio_seconds:123},{...edition,reading_format_id:2},{...edition,reading_format:{format:'Unknown'}},{...edition,release_date:'2099-01-01'}])
  expect(hardcoverDiscoveryEligible({title:'A Novel',editions:[e]})).toBe(false);
 expect(hardcoverDiscoveryEligible({title:'A Novel',editions:[{...edition,reading_format:{format:'Ebook'}}]})).toBe(true);
 expect(hardcoverDiscoveryEligible({title:'A Novel',default_physical_edition:edition})).toBe(true);
});
test('genre labels use recognized English classifications and omit unknown subject jargon',()=>{
 expect(normalizeBookGenres(['Fängelser','TV-spel','Fantasy','LitRPG','Fantasy'])).toEqual(['Fantasy','LitRPG']);
 expect(normalizeBookGenres(['Fiction / Fantasy / General','Science Fiction','romantasy'])).toEqual(['Fantasy','Science Fiction','Romantic Fantasy']);
 expect(normalizeBookGenres(['Fängelser / TV-spel'])).toEqual([]);
});
