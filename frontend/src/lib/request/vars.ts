import type { ApiRequest } from '../shared/types';

// NOTE: the same patterns exist in Go (internal/collection/resolve.go) — they
// are the variable syntax contract between frontend and backend.
//
// Env {{vars}} allow kebab-case (hyphens) on top of word characters.
// Dynamic :vars are recognized only after a delimiter (start, /, =, &, ?,
// comma or whitespace) so schemes, basic auth, ports and colons inside
// header values never match; their names take no hyphens, so a literal
// -suffix after a variable stays expressible.
// DYNAMIC_VAR_RE captures the delimiter (group 1) and the name (group 2)
// so replacements can keep the delimiter.
export const ENV_VAR_RE = /\{\{([A-Za-z_][A-Za-z0-9_-]*)\}\}/g;
export const DYNAMIC_VAR_RE = /(^|[/=&?,\s]):([A-Za-z_][A-Za-z0-9_]*)/g;

function requestHaystack(r: ApiRequest, extra: string[] = []): string {
  return [r.url, ...Object.entries(r.query).flat(), ...Object.entries(r.headers).flat(), r.body.content, ...extra].join('\n');
}

// Env vars referenced anywhere in the request (and in inherited headers),
// in order of first appearance.
export function extractEnvVars(r: ApiRequest, extra: string[] = []): string[] {
  const seen = new Set<string>();
  for (const m of requestHaystack(r, extra).matchAll(ENV_VAR_RE)) seen.add(m[1]);
  return [...seen];
}

// Dynamic :vars used anywhere in the request, in order of appearance.
export function extractDynamicVars(r: ApiRequest, extra: string[] = []): string[] {
  const seen = new Set<string>();
  for (const m of requestHaystack(r, extra).matchAll(DYNAMIC_VAR_RE)) seen.add(m[2]);
  return [...seen];
}
