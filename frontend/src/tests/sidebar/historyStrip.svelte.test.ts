// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { get } from 'svelte/store';

const selectRequest = vi.fn();
vi.mock('../../lib/workspace/requests', () => ({
  selectRequest: (...a: unknown[]) => selectRequest(...a),
}));

import HistoryStrip from '../../lib/sidebar/HistoryStrip.svelte';
import { historyPaths } from '../../lib/shared/stores';
import { expanded } from '../../lib/sidebar/treeView';
import { activeIdx, collections } from '../../lib/workspace/state';
import type { Collection } from '../../lib/shared/types';

const col: Collection = {
  name: 'c',
  root: '/c',
  tree: [
    { name: 'auth', path: '/c/auth', isFolder: true, children: [{ name: 'login', path: '/c/auth/login.toml', isFolder: false }] },
    { name: 'ping', path: '/c/ping.toml', isFolder: false },
  ],
} as Collection;

function mountStrip() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const comp = mount(HistoryStrip, { target: host });
  flushSync();
  return { host, comp };
}

beforeEach(() => {
  selectRequest.mockClear();
  collections.set([col]);
  activeIdx.set(0);
  expanded.set({});
  historyPaths.set({ '/c': ['/c/auth/login.toml', '/c/ping.toml'] });
});

describe('HistoryStrip', () => {
  it('renders one slot per history entry, newest first, heat-colored', () => {
    const { host, comp } = mountStrip();
    const slots = host.querySelectorAll<HTMLButtonElement>('.slot');
    expect(slots).toHaveLength(2);
    expect(slots[0].getAttribute('aria-label')).toBe('login');
    expect(slots[0].getAttribute('data-heat')).toContain('hsla');
    unmount(comp);
  });

  it('renders nothing when the collection has no history', () => {
    historyPaths.set({});
    const { host, comp } = mountStrip();
    expect(host.querySelector('.history-strip')).toBeNull();
    unmount(comp);
  });

  it('hover shows the popup with name and folder path, following the pointer', () => {
    const { host, comp } = mountStrip();
    const slots = host.querySelectorAll<HTMLButtonElement>('.slot');
    slots[0].dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 30 }));
    flushSync();
    const tip = host.querySelector('.history-tip')!;
    expect(tip.textContent).toContain('login');
    expect(tip.textContent).toContain('auth');
    // scrubbing to the next slot swaps the content in place
    slots[1].dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 55 }));
    flushSync();
    expect(host.querySelector('.history-tip')!.textContent).toContain('ping');
    host.querySelector('.history-strip')!.dispatchEvent(new MouseEvent('mouseleave'));
    flushSync();
    expect(host.querySelector('.history-tip')).toBeNull();
    unmount(comp);
  });

  it('click opens the request and reveals it in the tree', () => {
    const { host, comp } = mountStrip();
    host.querySelectorAll<HTMLButtonElement>('.slot')[0].click();
    flushSync();
    expect(selectRequest).toHaveBeenCalledTimes(1);
    expect(selectRequest.mock.calls[0][0].path).toBe('/c/auth/login.toml');
    expect(get(expanded)['/c/auth'], 'parent folder should be expanded by reveal').toBe(true);
    unmount(comp);
  });

  it('skips clicks on entries whose file is gone from the tree', () => {
    historyPaths.set({ '/c': ['/c/deleted.toml'] });
    const { host, comp } = mountStrip();
    host.querySelectorAll<HTMLButtonElement>('.slot')[0].click();
    flushSync();
    expect(selectRequest).not.toHaveBeenCalled();
    unmount(comp);
  });
});
