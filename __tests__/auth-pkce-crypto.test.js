const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const {createHash,randomFillSync} = require('node:crypto');

test('native shim supplies secure random values and the RFC 7636 SHA-256 digest', async () => {
 const exports = {};
 const source = fs.readFileSync('src/lib/auth-pkce-crypto.ts','utf8');
 const {outputText} = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const nativeDigest = jest.fn(async (name,data) => Uint8Array.from(createHash(name).update(data).digest()).buffer);
 const nativeRandom = jest.fn(data => randomFillSync(data));
 const context = vm.createContext({exports,Uint8Array,require: name => name === 'react-native'
   ? {Platform:{OS:'ios'}} : {digest:nativeDigest,getRandomValues:nativeRandom,CryptoDigestAlgorithm:{SHA256:'sha256'}}});
 vm.runInContext(outputText,context);
 exports.installNativePkceCrypto();
 const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
 const result = await context.crypto.subtle.digest('SHA-256', Buffer.from(verifier));
 expect(Buffer.from(result).toString('base64url')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
 const buffer = new Uint32Array(56);
 expect(context.crypto.getRandomValues(buffer)).toBe(buffer);
 expect(nativeRandom).toHaveBeenCalledWith(expect.any(Uint8Array));
 expect(nativeRandom.mock.calls[0][0].byteLength).toBe(buffer.byteLength);
});
