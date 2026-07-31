import { describe, expect, it } from 'vitest';
import { autoMode, looksLikeJson } from '../../lib/response/responseMode';
import type { ApiResponse } from '../../lib/shared/types';

function resp(overrides: Partial<ApiResponse> = {}): ApiResponse {
  return {
    finalUrl: 'https://h/x',
    requestHeaders: {},
    contentType: '',
    status: 200,
    statusText: 'OK',
    headers: {},
    body: '',
    durationMs: 1,
    size: 0,
    ...overrides,
  };
}

describe('autoMode', () => {
  it('picks image for image content types', () => {
    expect(autoMode(resp({ contentType: 'image/png' }))).toBe('image');
  });

  it('picks json for json content types regardless of body', () => {
    expect(autoMode(resp({ contentType: 'application/json; charset=utf-8', body: 'not json' }))).toBe('json');
  });

  it('picks json when the body parses despite a plain content type', () => {
    expect(autoMode(resp({ contentType: 'text/plain', body: '{"a":1}' }))).toBe('json');
  });

  it('falls back to raw', () => {
    expect(autoMode(resp({ contentType: 'text/html', body: '<html>' }))).toBe('raw');
  });
});

describe('looksLikeJson', () => {
  it('rejects unparseable non-json bodies', () => {
    expect(looksLikeJson(resp({ body: 'hello' }))).toBe(false);
  });
});
