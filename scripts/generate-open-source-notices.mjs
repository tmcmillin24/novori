import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const lockText = await readFile(path.join(root, "package-lock.json"), "utf8");
const lock = JSON.parse(lockText).packages;
const overrides = JSON.parse(
  await readFile(
    path.join(root, "scripts/legal/notice-overrides.json"),
    "utf8",
  ),
);
const natives = JSON.parse(
  await readFile(path.join(root, "scripts/legal/native-notices.json"), "utf8"),
);
const visited = new Set();
function resolveDependency(parent, name) {
  for (
    let cursor = parent;
    ;
    cursor = cursor.includes("/node_modules/")
      ? cursor.slice(0, cursor.lastIndexOf("/node_modules/"))
      : ""
  ) {
    const candidate = `${cursor ? `${cursor}/` : ""}node_modules/${name}`;
    if (lock[candidate]) return candidate;
    if (!cursor) return null;
  }
}
function visit(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const meta = lock[key];
  for (const name of Object.keys({
    ...meta.dependencies,
    ...meta.optionalDependencies,
    ...meta.peerDependencies,
  })) {
    const child = resolveDependency(key, name);
    if (child) visit(child);
  }
}
for (const name of Object.keys(lock[""].dependencies)) {
  const key = resolveDependency("", name);
  if (!key) throw new Error(`Unresolved production dependency: ${name}`);
  visit(key);
}
const noticePattern =
  /^(licen[sc]e|copying|notice|copyright|unlicense)([._-]|$)/i;
async function noticeFiles(directory, prefix = "", depth = 0) {
  if (depth > 5) return [];
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name === "node_modules") continue;
    const relative = prefix + entry.name;
    if (entry.isDirectory())
      result.push(
        ...(await noticeFiles(
          path.join(directory, entry.name),
          `${relative}/`,
          depth + 1,
        )),
      );
    else if (entry.isFile() && noticePattern.test(entry.name)) {
      const text = await readFile(path.join(directory, entry.name), "utf8");
      if (text.trim().length > 100) result.push({ file: relative, text });
    }
  }
  return result.sort((a, b) => a.file.localeCompare(b.file, "en"));
}
async function storedNotice(entry) {
  const text = await readFile(
    path.join(root, "scripts/legal", entry.file),
    "utf8",
  );
  if (createHash("sha256").update(text).digest("hex") !== entry.sha256)
    throw new Error(`Notice checksum failed: ${entry.file}`);
  return { file: entry.source, text };
}
const packages = new Map();
for (const key of [...visited].sort()) {
  const meta = lock[key],
    name = key.split("node_modules/").at(-1),
    id = `${name}@${meta.version}`;
  const directory = path.join(root, key);
  let notices = [];
  try {
    await stat(directory);
    const installed = JSON.parse(
      await readFile(path.join(directory, "package.json"), "utf8"),
    );
    if (installed.version !== meta.version)
      throw new Error(`Install does not match lockfile: ${id}`);
    notices = await noticeFiles(directory);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (!notices.length && overrides[id])
    notices = [await storedNotice(overrides[id])];
  if (!notices.length)
    throw new Error(
      `Missing full license/copyright notice: ${id}. Add a reviewed version-specific notice override.`,
    );
  if (!meta.license) throw new Error(`Missing license identifier: ${id}`);
  if (!packages.has(id))
    packages.set(id, {
      name,
      version: meta.version,
      license: meta.license,
      notices,
    });
  else {
    const existing = packages.get(id);
    for (const notice of notices)
      if (!existing.notices.some((n) => n.text === notice.text))
        existing.notices.push(notice);
  }
}
for (const entry of natives) {
  if (entry.name === "Jimp") continue; // Included above through the jimp-compact override.
  packages.set(`${entry.name}@${entry.version}`, {
    name: entry.name,
    version: entry.version,
    license: entry.license,
    notices: [await storedNotice(entry)],
  });
}
const output = {
  lockfileSha256: createHash("sha256").update(lockText).digest("hex"),
  scope:
    "Notices for Novori’s production dependency graph, including transitive dependencies and supporting tools, bundled fonts and icons, and the listed native libraries. License terms belong to their respective authors and remain in effect independently of Novori’s service terms.",
  packages: [...packages.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en") ||
      a.version.localeCompare(b.version, "en"),
  ),
};
const target = path.join(root, "src/generated/open-source-notices.json");
const text = JSON.stringify(output, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== text)
    throw new Error(
      "Open-source notices are stale. Run npm run licenses:generate and review the changes.",
    );
} else {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
}
console.log(
  `${output.packages.length} dependency and native notices ${process.argv.includes("--check") ? "verified" : "generated"}.`,
);
