# CommonJS compatibility copy

Source: upstream decode-uri-component 0.5.0, https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0.

The upstream release fixes GHSA-vcc3-ghjq-m6fr, but exports an ES module. Expo Router SDK 57 uses query-string 7, which expects a CommonJS decoder function. This copy changes only the export declaration to module.exports; the decoding algorithm is unchanged. upstream-index.mjs records the exact original source, and the MIT license is retained.

Upstream index.js SHA-256: 9401353df38f8010ad7035fe8d666bce6a4902bc1cff809afc4ab23fa2e0bdaa

Remove the override when Expo Router adopts a compatible fixed decoder. Regression tests check source equivalence, malformed URLs, and the existing query-string import contract.
