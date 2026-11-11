// Mutation helpers for the open request: every edit marks it dirty, and the
// URL bar and query tab stay two views of the same state.

import { get } from 'svelte/store';
import type { ApiRequest } from '../shared/types';
import { buildUrl, queryAfterUrlEdit, splitUrl } from '../shared/urlQuery';
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
    ({ query: r.query, disabledQuery: r.disabledQuery } = queryAfterUrlEdit(v, r.query, r.disabledQuery));
  });
}

export function setQuery(q: Record<string, string>) {
  edit((r) => {
    r.query = q;
    r.disabledQuery = r.disabledQuery.filter((k) => k in q);
    r.url = buildUrl(splitUrl(r.url).base, q, r.disabledQuery);
  });
}

export function setQueryEnabled(key: string, enabled: boolean) {
  edit((r) => {
    const rest = r.disabledQuery.filter((k) => k !== key);
    r.disabledQuery = enabled ? rest : [...rest, key];
    r.url = buildUrl(splitUrl(r.url).base, r.query, r.disabledQuery);
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

export function setTestScript(s: string) {
  edit((r) => (r.tests = { script: s }));
}

// dynamic :var values live on the request and persist with it; an empty
// value drops the key so saved files stay clean
export function setVar(name: string, value: string) {
  edit((r) => {
    if (value === '') {
      const { [name]: _, ...rest } = r.vars;
      r.vars = rest;
    } else {
      r.vars = { ...r.vars, [name]: value };
    }
  });
}
