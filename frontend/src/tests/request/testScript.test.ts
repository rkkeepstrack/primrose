import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { setTestScript } from '../../lib/request/requestEdit';
import { normalizeRequest } from '../../lib/workspace/requests';
import { dirty, request } from '../../lib/workspace/state';
import type { ApiRequest } from '../../lib/shared/types';

function blank(): ApiRequest {
  return {
    method: 'GET',
    url: '',
    query: {},
    headers: {},
    body: { type: 'json', content: '' },
    vars: {},
    tests: { script: '' },
  };
}

describe('setTestScript', () => {
  beforeEach(() => {
    request.set(blank());
    dirty.set(false);
  });

  it('stores the script on the request and marks it dirty', () => {
    setTestScript('assert res.status == 200');
    expect(get(request)?.tests.script).toBe('assert res.status == 200');
    expect(get(dirty)).toBe(true);
  });

  it('does nothing without an open request', () => {
    request.set(null);
    setTestScript('assert 1');
    expect(get(request)).toBeNull();
    expect(get(dirty)).toBe(false);
  });
});

describe('normalizeRequest', () => {
  it('backfills vars and tests missing from old files', () => {
    const raw = {
      method: 'GET',
      url: '',
      query: {},
      headers: {},
      body: { type: 'json', content: '' },
    } as unknown as ApiRequest;
    const r = normalizeRequest(raw);
    expect(r.vars).toEqual({});
    expect(r.tests).toEqual({ script: '' });
  });

  it('leaves present vars and tests untouched', () => {
    const r = normalizeRequest({ ...blank(), vars: { id: '7' }, tests: { script: 'assert 1' } });
    expect(r.vars).toEqual({ id: '7' });
    expect(r.tests).toEqual({ script: 'assert 1' });
  });
});
