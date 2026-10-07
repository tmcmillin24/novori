import { decodeHTMLStrict } from 'entities';

/** Presentation only: never write the formatted text back to the catalog/cache. */
export function formatBookDescription(description?: string | null): string {
  if (!description) return '';

  let text = description;
  // Some providers escape an already-escaped description. Bound the work while
  // handling both normal entities and double/triple-encoded provider payloads.
  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = decodeHTMLStrict(text);
    if (decoded === text) break;
    text = decoded;
  }

  return text
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi, '')
    .replace(/<br\b[^>]*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/li\s*>/gi, '')
    .replace(/<\/?(?:p|div|section|article|blockquote|h[1-6]|ul|ol)\b[^>]*>/gi, '\n\n')
    .replace(/<\/?[a-z][a-z0-9:-]*\b[^>]*>/gi, '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
