import { describe, expect, it } from 'vitest';
import { toCurl } from '../../lib/request/curl';
import type { ApiRequest } from '../../lib/shared/types';

function req(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'GET',
    url: 'https://api.example.com/users',
    query: {},
    headers: {},
    body: { type: 'json', content: '' },
    vars: {},
    ...overrides,
  };
}

describe('toCurl', () => {
  it('renders a bare GET', () => {
    expect(toCurl(req(), {}, {})).toBe(`curl -X GET 'https://api.example.com/users'`);
  });

  it('resolves env vars in URL, headers and body', () => {
    const r = req({
      url: '{{base}}/users',
      headers: { Authorization: 'Bearer {{token}}' },
      body: { type: 'json', content: '{"host":"{{base}}"}' },
    });
    const out = toCurl(r, { base: 'https://x.dev', token: 'abc' }, {});
    expect(out).toContain(`curl -X GET 'https://x.dev/users'`);
    expect(out).toContain(`-H 'Authorization: Bearer abc'`);
    expect(out).toContain(`--data '{"host":"https://x.dev"}'`);
  });

  it('leaves unknown env vars visible', () => {
    expect(toCurl(req({ url: '{{base}}/x' }), {}, {})).toContain(`'{{base}}/x'`);
  });

  it('resolves dynamic :vars only after delimiters and keeps the delimiter', () => {
    const r = req({ url: 'https://u:pw@h:8080/users/:id?x=:id', vars: { id: '42' } });
    const out = toCurl(r, {}, {});
    // scheme colon, basic auth and port stay; path and query vars resolve
    expect(out).toContain(`'https://u:pw@h:8080/users/42?x=42'`);
  });

  it('leaves unknown dynamic vars as-is', () => {
    expect(toCurl(req({ url: 'https://h/x/:id' }), {}, {})).toContain('/x/:id');
  });

  it('merges a query string carried in by a variable value', () => {
    const r = req({ url: '{{base}}?b=2', query: {} });
    const out = toCurl(r, { base: 'https://h/p?a=1' }, {});
    expect(out).toContain(`'https://h/p?a=1&b=2'`);
  });

  it('percent-encodes query values idempotently', () => {
    const out = toCurl(req({ url: 'https://h/p?a=x/y&b=already%20enc&c' }), {}, {});
    expect(out).toContain(`'https://h/p?a=x%2Fy&b=already%20enc&c'`);
  });

  it('keeps malformed percent escapes verbatim', () => {
    const out = toCurl(req({ url: 'https://h/p?bad=%zz' }), {}, {});
    expect(out).toContain('bad=%zz');
  });

  it('merges inherited headers, request headers win, empty value removes', () => {
    const r = req({ headers: { 'X-A': 'own', 'X-Gone': '' } });
    const out = toCurl(r, {}, { 'X-A': 'inherited', 'X-B': 'kept', 'X-Gone': 'inherited' });
    expect(out).toContain(`-H 'X-A: own'`);
    expect(out).toContain(`-H 'X-B: kept'`);
    expect(out).not.toContain('X-Gone');
  });

  it('shell-quotes single quotes safely', () => {
    const out = toCurl(req({ body: { type: 'json', content: `it's` } }), {}, {});
    expect(out).toContain(`--data 'it'\\''s'`);
  });
});
