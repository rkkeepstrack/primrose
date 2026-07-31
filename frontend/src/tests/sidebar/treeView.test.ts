import { describe, expect, it, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { flatRequests, heatStyle, recentFilterOn, search, visibleTree } from '../../lib/sidebar/treeView';
import { activeIdx, collections } from '../../lib/workspace/state';
import { recentPaths } from '../../lib/shared/stores';
import type { Collection, TreeNode } from '../../lib/shared/types';

const tree: TreeNode[] = [
  {
    name: 'teasers',
    path: '/c/teasers',
    isFolder: true,
    children: [{ name: 'create', path: '/c/teasers/create.toml', isFolder: false, method: 'POST' }],
  },
  { name: 'get-users', path: '/c/get-users.toml', isFolder: false, method: 'GET' },
];

beforeEach(() => {
  collections.set([{ name: 'c', root: '/c', headers: {}, tree } as Collection]);
  activeIdx.set(0);
  search.set('');
  recentFilterOn.set(false);
  recentPaths.set([]);
});

describe('visibleTree', () => {
  it('shows the full tree by default', () => {
    expect(get(visibleTree)).toBe(tree);
  });

  it('recent mode flattens to recents, newest first, skipping unknown paths', () => {
    recentFilterOn.set(true);
    recentPaths.set(['/c/get-users.toml', '/gone.toml', '/c/teasers/create.toml']);
    const names = get(visibleTree).map((n) => n.name);
    expect(names).toEqual(['get-users', 'create']);
  });

  it('search applies inside recent mode', () => {
    recentFilterOn.set(true);
    recentPaths.set(['/c/get-users.toml', '/c/teasers/create.toml']);
    search.set('create');
    expect(get(visibleTree).map((n) => n.name)).toEqual(['create']);
  });
});

describe('flatRequests', () => {
  it('walks the visible tree depth-first, requests only', () => {
    expect(get(flatRequests).map((n) => n.name)).toEqual(['create', 'get-users']);
  });
});

describe('heatStyle', () => {
  it('returns nothing for unranked paths', () => {
    expect(heatStyle(undefined)).toBe('');
    expect(heatStyle(0)).toBe('');
  });

  it('produces a valid hsla with intensity scaling by rank', () => {
    const fresh = heatStyle(1);
    const old = heatStyle(0.1);
    expect(fresh).toMatch(/^--heat-bg: hsla\(\d+, 80%, 52%, 0\.110\)$/);
    expect(old).toMatch(/0\.011\)$/);
  });
});
