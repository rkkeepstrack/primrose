// Picks the body view mode for a response (auto mode of ResponseBody).

import type { ApiResponse } from '../shared/types';

export type BodyMode = 'json' | 'raw' | 'image';

export function autoMode(r: ApiResponse): BodyMode {
  if (r.contentType?.startsWith('image/')) return 'image';
  if (looksLikeJson(r)) return 'json';
  return 'raw';
}

// heuristic: trusts the content type, falls back to attempting a parse
export function looksLikeJson(r: ApiResponse): boolean {
  if (r.contentType?.includes('json')) return true;
  try {
    JSON.parse(r.body);
    return true;
  } catch {
    return false;
  }
}
