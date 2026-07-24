// String-level URL query handling. Deliberately not `new URL()` — URLs here
// may contain {{vars}} and /:dynamic segments that must survive untouched.

export function splitUrl(url: string): { base: string; pairs: [string, string][] } {
  const i = url.indexOf('?');
  if (i === -1) return { base: url, pairs: [] };
  const base = url.slice(0, i);
  const pairs: [string, string][] = [];
  for (const part of url.slice(i + 1).split('&')) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    if (eq === -1) pairs.push([part, '']);
    else pairs.push([part.slice(0, eq), part.slice(eq + 1)]);
  }
  return { base, pairs };
}

export function buildUrl(base: string, query: Record<string, string>): string {
  const entries = Object.entries(query);
  if (entries.length === 0) return base;
  return base + '?' + entries.map(([k, v]) => `${k}=${v}`).join('&');
}

// URL is the source of truth for query params; returns the query map view.
export function queryFromUrl(url: string): Record<string, string> {
  return Object.fromEntries(splitUrl(url).pairs);
}

// Compose a request loaded from disk into a consistent state: params from the
// [query] section that are missing in the URL get appended to it.
export function normalizeUrlAndQuery(
  url: string,
  query: Record<string, string>
): { url: string; query: Record<string, string> } {
  const { base, pairs } = splitUrl(url);
  const merged: Record<string, string> = Object.fromEntries(pairs);
  for (const [k, v] of Object.entries(query)) {
    if (!(k in merged)) merged[k] = v;
  }
  return { url: buildUrl(base, merged), query: merged };
}
