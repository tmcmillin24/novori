const labels = { book: 'book', post: 'post', stack: 'book stack' };

export function getSharedItem(pathname) {
  const match = /^\/(book|post|stack)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  let id;
  try {
    id = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  if (!id || id.length > 512 || /[\x00-\x1f\x7f]/.test(id)) return null;
  const kind = match[1];
  // Encode the identifier afresh, never copy query parameters or another URL.
  return {
    kind,
    label: labels[kind],
    appUrl: `novori://${kind}/${encodeURIComponent(id)}${kind === 'book' ? '?source=shared' : ''}`,
  };
}
