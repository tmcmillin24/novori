import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Run from any directory; only website/dist is generated or replaced.
const output = new URL('./dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('./public/', import.meta.url), output, { recursive: true });
await mkdir(new URL('./dist/assets/', import.meta.url), { recursive: true });
await cp(
  new URL('../assets/images/novori_appicon.png', import.meta.url),
  new URL('./dist/assets/novori.png', import.meta.url),
);
console.log(`Novori website built: ${fileURLToPath(output)}`);
