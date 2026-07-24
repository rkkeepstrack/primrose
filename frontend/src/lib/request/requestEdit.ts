// Mutation helpers for the open request: every edit marks it dirty, and the
// URL bar and query tab stay two views of the same state.

import { get } from 'svelte/store';
import type { ApiRequest } from '../shared/types';
import { buildUrl, queryFromUrl, splitUrl } from '../shared/urlQuery';
import { dirty, request } from '../workspace/state';

export function edit(mutate: (r: ApiRequest) => void) {
  const r = get(request);
  if (!r) return;
  mutate(r);
  request.set(r);
  dirty.set(true);
}

export function setMethod(m: string) {
  edit((r) => (r.method = m));
}

export function setUrl(v: string) {
  edit((r) => {
    r.url = v;
    r.query = queryFromUrl(v);
  });
}

export function setQuery(q: Record<string, string>) {
  edit((r) => {
    r.query = q;
    r.url = buildUrl(splitUrl(r.url).base, q);
  });
}

export function setHeaders(h: Record<string, string>) {
  edit((r) => (r.headers = h));
}

export function setBodyType(t: 'json' | 'text') {
  edit((r) => (r.body.type = t));
}

export function setBodyContent(c: string) {
  edit((r) => (r.body.content = c));
}
