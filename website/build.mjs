import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getLinkConfig } from './link-config.mjs';

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
console.log(`Novori website built: ${fileURLToPath(output)}`);
