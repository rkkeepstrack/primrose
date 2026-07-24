import { describe, expect, it } from 'vitest';
import { fmtSize, fmtElapsed, prettyJson, statusClass } from '../../lib/response/format';

describe('fmtSize', () => {
  it('formats bytes, KB and MB', () => {
    expect(fmtSize(512)).toBe('512 B');
    expect(fmtSize(2048)).toBe('2.0 KB');
    expect(fmtSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('fmtElapsed', () => {
  it('switches to seconds at 1000ms', () => {
    expect(fmtElapsed(999)).toBe('999 ms');
    expect(fmtElapsed(1500)).toBe('1.5 s');
  });
});

describe('prettyJson', () => {
  it('pretty-prints valid JSON', () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  });
  it('returns invalid JSON verbatim', () => {
    expect(prettyJson('not json')).toBe('not json');
  });
});

describe('statusClass', () => {
  it('classifies status codes', () => {
    expect(statusClass(200)).toBe('ok');
    expect(statusClass(301)).toBe('other');
    expect(statusClass(404)).toBe('err');
    expect(statusClass(503)).toBe('err');
  });
});
