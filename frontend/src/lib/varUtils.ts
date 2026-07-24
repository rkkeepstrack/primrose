import type { ApiRequest } from './types';

// NOTE: the same patterns exist in Go (internal/collection/resolve.go) — they
// are the {{env}} / :dynamic syntax contract between frontend and backend.
const ENV_VAR_RE = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;
const DYNAMIC_VAR_RE = /\/:([A-Za-z_][A-Za-z0-9_]*)/g;

// Env vars referenced anywhere in the request, in order of first appearance.
export function extractEnvVars(r: ApiRequest): string[] {
  const haystack = [
    r.url,
    ...Object.entries(r.query).flat(),
    ...Object.entries(r.headers).flat(),
    r.body.content,
  ].join('\n');
  const seen = new Set<string>();
  for (const m of haystack.matchAll(ENV_VAR_RE)) seen.add(m[1]);
  return [...seen];
}

// Dynamic /:vars in the URL path, in order of appearance.
export function extractDynamicVars(url: string): string[] {
  const seen = new Set<string>();
  for (const m of url.matchAll(DYNAMIC_VAR_RE)) seen.add(m[1]);
  return [...seen];
}
