import { signOutCurrentDevice } from '../src/lib/sign-out';
import { supabase } from '../src/lib/supabase';
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { signOut: jest.fn(), getSession: jest.fn() } } }));
beforeEach(() => jest.clearAllMocks());
test('a server logout error does not trap an already signed-out device', async () => {
  supabase.auth.signOut.mockResolvedValue({ error: Error('Network unavailable') });
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  await expect(signOutCurrentDevice()).resolves.toBeUndefined();
  expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
test('a remaining session cannot be presented as successful sign-out', async () => {
  supabase.auth.signOut.mockResolvedValue({ error: Error('Network unavailable') });
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'reader' } } }, error: null });
  await expect(signOutCurrentDevice()).rejects.toThrow('Network unavailable');
});
