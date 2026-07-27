import type { ApiRequest } from '../shared/types';

// Same variable syntax contract as vars.ts / the Go resolver
// (internal/collection/resolve.go).
const ENV_VAR_RE = /\{\{([A-Za-z_][A-Za-z0-9_-]*)\}\}/g;
const DYNAMIC_VAR_RE = /(^|[/=&?,\s]):([A-Za-z_][A-Za-z0-9_]*)/g;

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// Renders the request as a runnable curl command, with {{env}} and :dynamic
// variables resolved the way sending would. Unknown variables are left as-is
// so the gap is visible in the copied command.
export function toCurl(
  r: ApiRequest,
  envVars: Record<string, string>,
  inheritedHeaders: Record<string, string>
): string {
  const resolve = (s: string) =>
    s
      .replace(ENV_VAR_RE, (m, name) => envVars[name] ?? m)
      .replace(DYNAMIC_VAR_RE, (m, delim, name) => delim + ((r.vars ?? {})[name] ?? `:${name}`));

  const lines = [`curl -X ${r.method} ${shellQuote(resolve(r.url))}`];

  // request headers override inherited ones; an empty value removes a header
  const headers = { ...inheritedHeaders, ...r.headers };
  for (const [k, v] of Object.entries(headers).sort(([a], [b]) => a.localeCompare(b))) {
    if (v === '') continue;
    lines.push(`-H ${shellQuote(`${k}: ${resolve(v)}`)}`);
  }

  if (r.body.content.trim() !== '') {
    lines.push(`--data ${shellQuote(resolve(r.body.content))}`);
  }

  return lines.join(' \\\n  ');
}
