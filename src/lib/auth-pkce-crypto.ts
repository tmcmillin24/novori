import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';
import { Platform } from 'react-native';

// Supabase Auth needs secure randomness and SHA-256 for PKCE on native.
// Supply only its missing operations using the installed Expo native module.
export function installNativePkceCrypto() {
  if (Platform.OS === 'web') return;
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', { configurable:true, value:{} });
  }
  const crypto = globalThis.crypto;
  if (typeof crypto.getRandomValues !== 'function') {
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable:true,
      value: (array: Uint32Array) => {
        getRandomValues(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
        return array;
      },
    });
  }
  if (!crypto.subtle) {
    Object.defineProperty(crypto, 'subtle', { configurable:true, value:{} });
  }
  if (typeof crypto.subtle.digest !== 'function') {
    Object.defineProperty(crypto.subtle, 'digest', {
      configurable:true,
      value: (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
        if (name.toUpperCase() !== 'SHA-256') return Promise.reject(new Error('Unsupported digest algorithm.'));
        return digest(CryptoDigestAlgorithm.SHA256, data);
      },
    });
  }
}
