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
      })
    );
    expect(vars).toEqual(['base', 'tenant', 'galleryId', 'key']);
  });

  it('ignores malformed tokens', () => {
    expect(extractEnvVars(req({ url: '{{1bad}} {{}} {{good_1}}' }))).toEqual(['good_1']);
  });
});

describe('extractDynamicVars', () => {
  it('finds /:vars in the URL path only', () => {
    expect(extractDynamicVars('{{base}}/teasers/:teaserId/items/:itemId')).toEqual([
      'teaserId',
      'itemId',
    ]);
  });

  it('does not match ports or bare colons', () => {
    expect(extractDynamicVars('https://x.io:8080/path')).toEqual([]);
  });
});
