import { readFile, mkdir, writeFile } from "node:fs/promises";

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
export const legalFooter = `<footer class="site-footer shell"><a class="brand" href="/">Novori</a><nav aria-label="Legal and support"><a href="/terms/">Terms</a><a href="/privacy/">Privacy</a><a href="/licenses/">Licenses</a><a href="/child-safety/">Safety</a><a href="/delete-account/">Delete account</a><a href="/support/">Support</a></nav></footer>`;
export function legalPage({ title, summary, body, updated }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#242321"><title>${escapeHtml(title)} · Novori</title><meta name="description" content="${escapeHtml(summary)}"><link rel="icon" href="/assets/novori.png"><link rel="stylesheet" href="/style.css"></head>
<body><a class="skip" href="#main">Skip to content</a><header class="site-header shell"><a class="brand" href="/"><img src="/assets/novori.png" alt="" width="44" height="44"><span>Novori</span></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/support/">Support</a></nav></header>
<main id="main" class="shell legal-page"><p class="eyebrow">Novori · Trust &amp; community</p><h1>${escapeHtml(title)}</h1><p class="legal-summary">${escapeHtml(summary)}</p><p class="legal-date">Effective ${escapeHtml(updated)} · Tristan McMillin</p>${body}</main>${legalFooter}</body></html>\n`;
}
export async function buildLegalPages(output) {
  const legal = JSON.parse(
    await readFile(new URL("./legal-documents.json", import.meta.url), "utf8"),
  );
  const licenses = JSON.parse(
    await readFile(
      new URL("../src/generated/open-source-notices.json", import.meta.url),
      "utf8",
    ),
  );
  for (const [path, document] of Object.entries(legal.documents)) {
    const toc = `<nav class="legal-contents" aria-label="On this page">${document.sections.map((s, i) => `<a href="#section-${i + 1}">${escapeHtml(s.title)}</a>`).join("")}</nav>`;
    const body =
      toc +
      document.sections
        .map(
          (section, index) =>
            `<section class="legal-section" id="section-${index + 1}"><h2>${escapeHtml(section.title)}</h2>${section.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}${(section.links ?? []).map((l) => `<p><a class="text-link" href="${escapeHtml(l.url)}">${escapeHtml(l.label)} ↗</a></p>`).join("")}</section>`,
        )
        .join("");
    await mkdir(new URL(`${path}/`, output), { recursive: true });
    await writeFile(
      new URL(`${path}/index.html`, output),
      legalPage({ ...document, body, updated: legal.updated }),
    );
  }
  const body =
    `<p class="legal-note">${escapeHtml(licenses.scope)}</p><p>Book data and covers may be supplied by <a href="https://books.google.com/">Google Books</a>, <a href="https://hardcover.app/">Hardcover</a>, and <a href="https://openlibrary.org/">Open Library</a>. These services and their content have separate terms and rights; an API is not itself an open-source license.</p><p><a class="text-link" href="/open-source-notices.txt" download>Download the full notices ↗</a></p>` +
    licenses.packages
      .map(
        (p) =>
          `<details class="license"><summary>${escapeHtml(p.name)} <span>${escapeHtml(p.version)} · ${escapeHtml(p.license)}</span></summary>${p.notices.map((n) => `<h3>${escapeHtml(n.file)}</h3><pre>${escapeHtml(n.text)}</pre>`).join("")}</details>`,
      )
      .join("");
  await mkdir(new URL("licenses/", output), { recursive: true });
  await writeFile(
    new URL("licenses/index.html", output),
    legalPage({
      title: "Open Source Licenses",
      summary:
        "Acknowledgments and license notices for software and assets used by Novori.",
      body,
      updated: legal.updated,
    }),
  );
  await writeFile(
    new URL("open-source-notices.txt", output),
    licenses.packages
      .map(
        (p) =>
          `${p.name} ${p.version} (${p.license})\n${p.notices.map((n) => `${n.file}\n${n.text}`).join("\n\n")}`,
      )
      .join("\n\n" + "=".repeat(60) + "\n\n"),
  );
  // Include the same links in the landing, support, and shared-item pages.
  for (const path of ["index.html", "support/index.html", "share/index.html"]) {
    const url = new URL(path, output);
    const html = await readFile(url, "utf8");
    await writeFile(
      url,
      html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/, legalFooter),
    );
  }
}
