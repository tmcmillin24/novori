// Unit tests must stub their network requests. Expo's lazy native fetch getter
// otherwise initializes native modules during Jest teardown with partial RN mocks.
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: jest.fn(() => Promise.reject(new Error('Unexpected network request: mock fetch in this test'))),
});

// Public book caches use the existing native storage module. Keep its real
// asynchronous API contract in unit tests; individual tests can simulate faults.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
