import { describe, expect, it } from 'vitest';
import { splitUrl, buildUrl, queryFromUrl, normalizeUrlAndQuery } from '../../lib/shared/urlQuery';

describe('splitUrl', () => {
  it('splits base and pairs', () => {
    expect(splitUrl('https://x.io/a?b=1&c=2')).toEqual({
      base: 'https://x.io/a',
      pairs: [
        ['b', '1'],
        ['c', '2'],
      ],
    });
  });

  it('handles no query', () => {
    expect(splitUrl('https://x.io/a')).toEqual({ base: 'https://x.io/a', pairs: [] });
  });

  it('handles trailing ? and empty parts', () => {
    expect(splitUrl('https://x.io/a?')).toEqual({ base: 'https://x.io/a', pairs: [] });
    expect(splitUrl('https://x.io/a?b=1&&c=2').pairs).toHaveLength(2);
  });

  it('keeps = inside values', () => {
    expect(splitUrl('u?k=a=b').pairs).toEqual([['k', 'a=b']]);
  });

  it('keeps keys without values', () => {
    expect(splitUrl('u?flag').pairs).toEqual([['flag', '']]);
  });

  it('preserves template variables untouched', () => {
    const { base, pairs } = splitUrl('{{base}}/api?g={{id}}');
    expect(base).toBe('{{base}}/api');
    expect(pairs).toEqual([['g', '{{id}}']]);
  });
});

describe('buildUrl', () => {
  it('appends query params', () => {
    expect(buildUrl('u', { a: '1', b: '2' })).toBe('u?a=1&b=2');
  });
  it('returns base alone for empty query', () => {
    expect(buildUrl('u', {})).toBe('u');
  });
});

describe('queryFromUrl', () => {
  it('maps pairs', () => {
    expect(queryFromUrl('u?a=1&b=2')).toEqual({ a: '1', b: '2' });
  });
});

describe('normalizeUrlAndQuery', () => {
  it('merges [query]-only params into the URL', () => {
    const r = normalizeUrlAndQuery('u', { a: '1' });
    expect(r.url).toBe('u?a=1');
    expect(r.query).toEqual({ a: '1' });
  });

  it('URL params win over the query section', () => {
    const r = normalizeUrlAndQuery('u?a=fromUrl', { a: 'fromFile', b: '2' });
    expect(r.query.a).toBe('fromUrl');
    expect(r.url).toBe('u?a=fromUrl&b=2');
  });
});
