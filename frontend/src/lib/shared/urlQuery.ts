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

export function buildUrl(base: string, query: Record<string, string>, disabled: string[] = []): string {
  const entries = Object.entries(query).filter(([k]) => !disabled.includes(k));
  if (entries.length === 0) return base;
  return base + '?' + entries.map(([k, v]) => `${k}=${v}`).join('&');
}

// URL is the source of truth for query params; returns the query map view.
export function queryFromUrl(url: string): Record<string, string> {
  return Object.fromEntries(splitUrl(url).pairs);
}

export interface QueryState {
  url: string;
  query: Record<string, string>;
  disabledQuery: string[];
}

// Compose a request loaded from disk into a consistent state: params from the
// [query] section that are missing in the URL get appended to it, except
// disabled ones. A disabled key the URL carries anyway counts as re-enabled.
export function normalizeUrlAndQuery(url: string, query: Record<string, string>, disabled: string[] = []): QueryState {
  const { base, pairs } = splitUrl(url);
  const merged: Record<string, string> = Object.fromEntries(pairs);
  for (const [k, v] of Object.entries(query)) {
    if (!(k in merged)) merged[k] = v;
  }
  const disabledQuery = disabled.filter((k) => k in query && !pairs.some(([pk]) => pk === k));
  return { url: buildUrl(base, merged, disabledQuery), query: merged, disabledQuery };
}

// The URL bar was edited: its params replace the enabled ones, disabled
// params stay in their rows untouched unless the URL now names them.
export function queryAfterUrlEdit(url: string, prev: Record<string, string>, disabled: string[]): Omit<QueryState, 'url'> {
  const fromUrl = queryFromUrl(url);
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(prev)) {
    if (k in fromUrl) query[k] = fromUrl[k];
    else if (disabled.includes(k)) query[k] = v;
  }
  for (const [k, v] of Object.entries(fromUrl)) {
    if (!(k in query)) query[k] = v;
  }
  return { query, disabledQuery: disabled.filter((k) => k in query && !(k in fromUrl)) };
}
