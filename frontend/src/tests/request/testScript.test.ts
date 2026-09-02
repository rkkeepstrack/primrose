import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { setTestScript } from '../../lib/request/requestEdit';
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
