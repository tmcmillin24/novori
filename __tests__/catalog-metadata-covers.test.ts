import { cachedWorkCovers, cachedEditionCover } from '../supabase/functions/_shared/catalog-metadata-covers';
const row=(title:string,language='en',provider='isbndb')=>({id:title,work_id:title,provider,metadata:{volumeInfo:{title,authors:['Writer'],language,imageLinks:{medium:'https://publisher/cover.jpg'}}}});
test.each(['Catching Fire','1984','Piranesi','The Infinite Extent','Dungeon Crawler Carl','Fourth Wing','A Court of Mist and Fury','The Great Gatsby','Dune','The Hobbit'])('recovers cached publisher art for %s without a provider request',title=>{
 expect(cachedWorkCovers([row(title)]).get(title)?.url).toBe('https://publisher/cover.jpg');
});
test('recovery rejects foreign, supplementary and Hardcover artwork',()=>{
 expect(cachedEditionCover(row('A Novel','es'))).toBeNull();
 expect(cachedEditionCover(row('A Novel','en','hardcover'))).toBeNull();
 expect(cachedEditionCover(row('A Novel Coloring Book'))).toBeNull();
});

test('an ordinary edition with a missing ISBN cannot acquire owner-preference priority',()=>{
 const edition={...row('An Ordinary Novel'),isbn_13:null};
 expect(cachedWorkCovers([edition]).get(edition.work_id)).toMatchObject({preferred:false,score:0});
});
