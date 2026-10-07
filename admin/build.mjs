import { build } from "esbuild";
import { mkdir, rm, writeFile, copyFile } from "node:fs/promises";
const url =
  process.env.NOVORI_SUPABASE_URL || "https://oanpmuiuuwljknwvyzev.supabase.co";
const key = process.env.NOVORI_SUPABASE_PUBLISHABLE_KEY || "";
if (!key && !process.env.NOVORI_ADMIN_ALLOW_UNCONFIGURED)
  throw new Error(
    "Set NOVORI_SUPABASE_PUBLISHABLE_KEY to the public publishable/anon key. Never use a service key.",
  );
if (new URL(url).protocol !== "https:")
  throw new Error("HTTPS Supabase URL required");
if (key.startsWith("sb_secret_"))
  throw new Error("Secret keys must never be bundled.");
if (key.split(".").length === 3) {
  const claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url"));
  if (claims.role !== "anon")
    throw new Error("Only the public anon key is allowed.");
}
if (key && !key.startsWith("sb_publishable_") && key.split(".").length !== 3)
  throw new Error("Public Supabase key required.");
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: true,
  format: "esm",
  outfile: "dist/app.js",
  define: { __CONFIG__: JSON.stringify({ url, key }) },
  target: ["safari17", "chrome120"],
});
await Promise.all(
  ["index.html", "styles.css", "robots.txt"].map((name) =>
    copyFile(`public/${name}`, `dist/${name}`),
  ),
);
await copyFile("../assets/images/novori_appicon.png", "dist/novori.png");
await writeFile(
  "dist/_headers",
  `/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Robots-Tag: noindex, nofollow\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ${url}; img-src 'self' data: ${url}; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'\n`,
);
console.log("Built Novori Admin. Public configuration only.");
