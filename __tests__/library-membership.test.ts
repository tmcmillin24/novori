import { hasLibraryMembership } from '../src/lib/library-membership';
const empty = { owned:false,status:null,rating:null,review_text:null,started_at:null,finished_at:null,dnf_at:null };
test('cart-only ownership enters the library, then leaves when unchecked', () => {
  expect(hasLibraryMembership({...empty,owned:true})).toBe(true);
  expect(hasLibraryMembership(empty)).toBe(false);
});
test.each(['want_to_read','reading','read','dnf'] as const)('unowning keeps books marked %s',status=>{
  expect(hasLibraryMembership({...empty,status})).toBe(true);
});
test.each([
 {rating:4}, {review_text:'My private review'}, {started_at:'2026-10-27'}, {finished_at:'2026-10-27'}, {dnf_at:'2026-10-27'},
])('unowning preserves reviewed and previously tracked library entries: %j',activity=>{
 expect(hasLibraryMembership({...empty,...activity})).toBe(true);
});
test('blank review text alone is not a library entry',()=>{
 expect(hasLibraryMembership({...empty,review_text:'  '})).toBe(false);
});
