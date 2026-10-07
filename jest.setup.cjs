// Unit tests must stub their network requests. Expo's lazy native fetch getter
// otherwise initializes native modules during Jest teardown with partial RN mocks.
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: jest.fn(() => Promise.reject(new Error('Unexpected network request: mock fetch in this test'))),
});
