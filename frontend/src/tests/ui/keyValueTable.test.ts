import { describe, expect, it } from 'vitest';
import { findDuplicateKeys, toEntries, toRows } from '../../lib/ui/keyValueTable';

describe('toRows / toEntries', () => {
  it('round-trips entries', () => {
    const entries = { a: '1', b: '2' };
    expect(toEntries(toRows(entries))).toEqual(entries);
  });

  it('drops rows with empty or whitespace keys', () => {
    expect(
      toEntries([
        { key: '', value: 'x' },
        { key: '  ', value: 'y' },
        { key: 'a', value: '1' },
      ]),
    ).toEqual({ a: '1' });
  });

  it('lets the last duplicate win', () => {
    expect(
      toEntries([
        { key: 'a', value: '1' },
        { key: 'a', value: '2' },
      ]),
    ).toEqual({ a: '2' });
  });
});

describe('findDuplicateKeys', () => {
  it('flags repeated non-empty keys', () => {
    const dups = findDuplicateKeys([
      { key: 'a', value: '' },
      { key: 'a', value: '' },
      { key: 'b', value: '' },
    ]);
    expect([...dups]).toEqual(['a']);
  });

  it('ignores empty keys', () => {
    expect(
      findDuplicateKeys([
        { key: '', value: '' },
        { key: '', value: '' },
      ]).size,
    ).toBe(0);
  });
});
