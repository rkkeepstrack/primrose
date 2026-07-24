import { describe, expect, it } from 'vitest';
import { fuzzyMatch, filterTree } from '../../lib/sidebar/fuzzy';
import type { TreeNode } from '../../lib/shared/types';

describe('fuzzyMatch', () => {
  it('matches subsequences case-insensitively', () => {
    expect(fuzzyMatch('gtsr', 'get-teasers')).toBe(true);
    expect(fuzzyMatch('GTSR', 'get-teasers')).toBe(true);
    expect(fuzzyMatch('xyz', 'get-teasers')).toBe(false);
    expect(fuzzyMatch('', 'anything')).toBe(true);
  });

  it('requires order', () => {
    expect(fuzzyMatch('ba', 'ab')).toBe(false);
  });
});

const tree: TreeNode[] = [
  {
    name: 'teasers',
    path: '/c/teasers',
    isFolder: true,
    children: [
      { name: 'create-teaser', path: '/c/teasers/create.toml', isFolder: false, method: 'POST' },
      { name: 'delete-teaser', path: '/c/teasers/delete.toml', isFolder: false, method: 'DELETE' },
    ],
  },
  { name: 'get-users', path: '/c/get-users.toml', isFolder: false, method: 'GET' },
];

describe('filterTree', () => {
  it('returns everything for empty query', () => {
    expect(filterTree(tree, '  ')).toBe(tree);
  });

  it('prunes non-matching requests but keeps matching descendants', () => {
    const out = filterTree(tree, 'create');
    expect(out).toHaveLength(1);
    expect(out[0].children).toHaveLength(1);
    expect(out[0].children![0].name).toBe('create-teaser');
  });

  it('keeps whole folder when the folder name matches', () => {
    const out = filterTree(tree, 'teasers');
    expect(out[0].children).toHaveLength(2);
  });

  it('drops folders with no matches', () => {
    const out = filterTree(tree, 'users');
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('get-users');
  });
});
