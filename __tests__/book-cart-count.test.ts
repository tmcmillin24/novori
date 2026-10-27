const mockCount = jest.fn();
const mockSession = jest.fn();
let mockAuthChanged: (event: string, session: any) => void;
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: {
  getSession: () => mockSession(), onAuthStateChange: (callback: any) => { mockAuthChanged=callback; },
}, from: () => ({ select: () => ({ eq: () => mockCount() }) }) } }));
let cart: typeof import('../src/lib/book-cart-count');
beforeEach(() => {
  jest.resetModules(); mockCount.mockReset(); mockSession.mockReset();
  mockSession.mockResolvedValue({ data:{ session:{ user:{ id:'reader-a' } } }, error:null });
  mockCount.mockResolvedValue({ count:3, error:null });
  cart=require('../src/lib/book-cart-count');
});
test('coalesces header requests and reuses the count across tab focus', async () => {
  await Promise.all([cart.refreshBookCartCount(),cart.refreshBookCartCount()]);
  await cart.refreshBookCartCount();
  expect(mockCount).toHaveBeenCalledTimes(1); expect(cart.getBookCartCountSnapshot()).toBe(3);
});
test('successful mutations recheck the count and notify additions without incrementing duplicates', async () => {
  await cart.refreshBookCartCount(); const added=jest.fn(); cart.subscribeCartAdditions(added);
  cart.bookCartDidChange('reader-a','book',{title:'Alchemised'});
  await cart.refreshBookCartCount();
  expect(cart.getBookCartCountSnapshot()).toBe(3); expect(added).toHaveBeenCalledTimes(1); expect(mockCount).toHaveBeenCalledTimes(2);
});
test('logout clears badges and discards an in-flight previous-account response', async () => {
  let resolve: (result:any)=>void = () => {};
  mockCount.mockImplementationOnce(() => new Promise(done => { resolve=done; }));
  const loading=cart.refreshBookCartCount(); await Promise.resolve(); await Promise.resolve();
  mockAuthChanged('SIGNED_OUT',null); resolve({ count:9,error:null }); await loading;
  expect(cart.getBookCartCountSnapshot()).toBeNull();
});
test('failed refresh keeps the last confirmed count and can retry', async () => {
  await cart.refreshBookCartCount(); mockCount.mockResolvedValueOnce({count:null,error:new Error('offline')});
  cart.bookCartDidChange('reader-a','book'); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  await cart.refreshBookCartCount().catch(()=>{});
  expect(cart.getBookCartCountSnapshot()).toBe(3);
});

test('book pages receive confirmed add/remove state without another item lookup', async () => {
 await cart.refreshBookCartCount(); const changed=jest.fn(); cart.subscribeBookCartMutations(changed);
 cart.bookCartDidChange('reader-a','book',{title:'Book'}); cart.bookCartDidChange('reader-a','book');
 expect(changed.mock.calls).toEqual([[{bookId:'book',inCart:true}],[{bookId:'book',inCart:false}]]);
});
