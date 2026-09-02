// Secret variables: pure helpers shared by the env editor, the response
// pane's request-headers view and the Timeline. Masking is render-only —
// the real HTTP request always uses the real values.

import type { Environment } from './types';

// name -> value for the environment's secrets that actually have a value
// (declared-but-missing secrets have nothing to mask).
export function secretValues(env: Environment | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of env?.secrets ?? []) {
    const v = env!.vars[name];
    if (v) out[name] = v;
  }
  return out;
}

// replaces every occurrence of each secret value with its {{name}} placeholder;
// longest values first so overlapping secrets can't leave partial leftovers
export function maskSecrets(s: string, secretVals: Record<string, string>): string {
  const entries = Object.entries(secretVals).sort((a, b) => b[1].length - a[1].length);
  for (const [name, value] of entries) {
    if (value) s = s.split(value).join(`{{${name}}}`);
  }
  return s;
}

export function maskEntries(entries: Record<string, string>, secretVals: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, maskSecrets(v, secretVals)]));
}
