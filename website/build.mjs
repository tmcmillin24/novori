import { createHash } from 'node:crypto';
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getLinkConfig } from './link-config.mjs';
import { buildLegalPages } from './legal-pages.mjs';

// Never publish a stale license inventory after a dependency update.
const notices = JSON.parse(await readFile(new URL('../src/generated/open-source-notices.json', import.meta.url), 'utf8'));
const lockfile = await readFile(new URL('../package-lock.json', import.meta.url));
if (notices.lockfileSha256 !== createHash('sha256').update(lockfile).digest('hex')) throw new Error('Regenerate the open-source notices before building the website.');

// Run from any directory; only website/dist is generated or replaced.
const output = new URL('./dist/', import.meta.url);
const appConfig = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
const linkConfig = getLinkConfig(process.env, appConfig.expo.ios.bundleIdentifier);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('./public/', import.meta.url), output, { recursive: true });
await writeFile(new URL('./dist/download-config.mjs', import.meta.url), `export const downloadConfig = ${JSON.stringify(linkConfig.download)};\n`);
if (linkConfig.association) {
  await mkdir(new URL('./dist/.well-known/', import.meta.url), { recursive: true });
  await writeFile(new URL('./dist/.well-known/apple-app-site-association', import.meta.url), JSON.stringify(linkConfig.association));
}
await mkdir(new URL('./dist/assets/', import.meta.url), { recursive: true });
await cp(
  new URL('../assets/images/novori_appicon.png', import.meta.url),
  new URL('./dist/assets/novori.png', import.meta.url),
);
await buildLegalPages(output);
console.log(`Novori website built: ${fileURLToPath(output)}`);
