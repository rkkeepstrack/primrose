import { describe, expect, it } from 'vitest';
import { testBadge } from '../../lib/response/testReport';

describe('testBadge', () => {
  it('is green (ok) when all pass', () => {
    expect(testBadge({ results: [], passed: 3, total: 3 })).toEqual({ text: '3/3', ok: true });
  });

  it('is red (not ok) on any failure', () => {
    expect(testBadge({ results: [], passed: 1, total: 3 })).toEqual({ text: '1/3', ok: false });
  });

  it('an empty report counts as ok', () => {
    expect(testBadge({ results: [], passed: 0, total: 0 })).toEqual({ text: '0/0', ok: true });
  });
});
