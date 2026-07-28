import { describe, expect, it } from 'vitest';
import { extractEnvVars, extractDynamicVars } from '../../lib/request/vars';
import type { ApiRequest } from '../../lib/shared/types';

function req(partial: Partial<ApiRequest>): ApiRequest {
  return {
    method: 'GET',
    url: '',
    query: {},
    headers: {},
    body: { type: 'json', content: '' },
    vars: {},
    ...partial,
  };
}

describe('extractEnvVars', () => {
  it('finds vars across url, query, headers and body, deduplicated in order', () => {
    const vars = extractEnvVars(
      req({
        url: '{{base}}/api/{{tenant}}',
        query: { g: '{{galleryId}}' },
        headers: { 'X-Key': '{{key}}' },
        body: { type: 'json', content: '{"t": "{{tenant}}"}' },
      }),
    );
    expect(vars).toEqual(['base', 'tenant', 'galleryId', 'key']);
  });

  it('allows camelCase, kebab-case, snake_case and SCREAMING_SNAKE_CASE', () => {
    const vars = extractEnvVars(req({ url: '{{camelCase}}/{{kebab-case}}/{{snake_case}}/{{SCREAMING_SNAKE}}' }));
    expect(vars).toEqual(['camelCase', 'kebab-case', 'snake_case', 'SCREAMING_SNAKE']);
  });

  it('ignores malformed tokens', () => {
    expect(extractEnvVars(req({ url: '{{1bad}} {{}} {{good_1}}' }))).toEqual(['good_1']);
  });
});

describe('extractDynamicVars', () => {
  it('finds :vars after delimiters anywhere in the request', () => {
    const vars = extractDynamicVars(
      req({
        url: '{{base}}/teasers/:teaserId?g=:gallery',
        query: { ':dynKey': ':dynValue' },
        headers: { 'X-Trace': 'a=1,:trace' },
        body: { type: 'json', content: '{"id": :bodyId}' },
      }),
    );
    expect(vars).toEqual(['teaserId', 'gallery', 'dynKey', 'dynValue', 'trace', 'bodyId']);
  });

  it('does not match schemes, ports, basic auth or mid-value colons', () => {
    const vars = extractDynamicVars(
      req({
        url: 'https://user:pass@x.io:8080/path',
        headers: { Authorization: 'Bearer abc:def' },
      }),
    );
    expect(vars).toEqual([]);
  });

  it('hyphen ends a dynamic name', () => {
    expect(extractDynamicVars(req({ url: '/users/:id-copy' }))).toEqual(['id']);
  });
});
