import {normalizeRecentBookSearches} from '../src/lib/recent-book-searches';
test('recent search history is bounded, ignores corrupt values and deduplicates without losing displayed spelling',()=>{
 expect(normalizeRecentBookSearches([' Fourth   Wing ','fourth wing',null,42,'x','A Court of Thorns and Roses'])).toEqual(['Fourth Wing','A Court of Thorns and Roses']);
 expect(normalizeRecentBookSearches(Array.from({length:20},(_,i)=>`Book ${i}`))).toHaveLength(10);
 expect(normalizeRecentBookSearches({bad:true})).toEqual([]);
 expect(normalizeRecentBookSearches(['a'.repeat(161)])).toEqual([]);
});
