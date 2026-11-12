import { describe, expect, it } from 'vitest';
import { splitUrl, buildUrl, queryFromUrl, normalizeUrlAndQuery, queryAfterUrlEdit } from '../../lib/shared/urlQuery';

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

describe('disabled query params', () => {
  it('buildUrl leaves disabled keys out', () => {
    expect(buildUrl('u', { a: '1', debug: 'true' }, ['debug'])).toBe('u?a=1');
  });

  it('normalizeUrlAndQuery does not fold disabled keys into the URL', () => {
    const r = normalizeUrlAndQuery('u?a=1', { a: '1', debug: 'true' }, ['debug']);
    expect(r.url).toBe('u?a=1');
    expect(r.query).toEqual({ a: '1', debug: 'true' });
    expect(r.disabledQuery).toEqual(['debug']);
  });

  it('normalizeUrlAndQuery re-enables a disabled key that the URL carries', () => {
    const r = normalizeUrlAndQuery('u?debug=1', { debug: 'true' }, ['debug']);
    expect(r.query).toEqual({ debug: '1' });
    expect(r.disabledQuery).toEqual([]);
  });

  it('queryAfterUrlEdit keeps disabled params in place and re-enables typed ones', () => {
    const r = queryAfterUrlEdit('u?a=2&c=3', { a: '1', debug: 'true', b: '2' }, ['debug', 'b']);
    expect(Object.entries(r.query)).toEqual([
      ['a', '2'],
      ['debug', 'true'],
      ['b', '2'],
      ['c', '3'],
    ]);
    expect(r.disabledQuery).toEqual(['debug', 'b']);
    const typed = queryAfterUrlEdit('u?b=9', { debug: 'true', b: '2' }, ['debug', 'b']);
    expect(typed.query).toEqual({ debug: 'true', b: '9' });
    expect(typed.disabledQuery).toEqual(['debug']);
  });
});

describe('queryAfterUrlEdit while typing', () => {
  it('a half-typed param that starts like a disabled key leaves the disabled row alone', () => {
    let state = { query: { a: '1', page: '7' } as Record<string, string>, disabledQuery: ['page'] };
    for (const url of ['x?a=1&p', 'x?a=1&page', 'x?a=1&page_', 'x?a=1&page_size=10']) {
      state = queryAfterUrlEdit(url, state.query, state.disabledQuery);
    }
    expect(state.query).toEqual({ a: '1', page: '7', page_size: '10' });
    expect(state.disabledQuery).toEqual(['page']);
  });

  it('a complete key= pair in the URL re-enables a disabled param with the URL value', () => {
    const s = queryAfterUrlEdit('x?page=3', { page: '7' }, ['page']);
    expect(s.query).toEqual({ page: '3' });
    expect(s.disabledQuery).toEqual([]);
  });
});
