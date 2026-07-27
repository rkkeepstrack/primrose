import { describe, expect, it, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  activateTab,
  activeTabId,
  addCollectionTab,
  closeTab,
  envTabId,
  envTabRoot,
  isEnvTab,
  isSpecialTab,
  moveTab,
  openSpecialTab,
  tabOrder,
} from '../../lib/workspace/tabs';
import { activeIdx, collections } from '../../lib/workspace/state';
import type { Collection } from '../../lib/shared/types';

const colA = { name: 'a', root: '/a', tree: [] } as Collection;
const colB = { name: 'b', root: '/b', tree: [] } as Collection;

beforeEach(() => {
  collections.set([colA, colB]);
  activeIdx.set(0);
  tabOrder.set([]);
  activeTabId.set(null);
});

describe('tab ids', () => {
  it('classifies env and special tabs', () => {
    expect(isEnvTab(envTabId('/a'))).toBe(true);
    expect(envTabRoot(envTabId('/a'))).toBe('/a');
    expect(isSpecialTab('shortcuts')).toBe(true);
    expect(isSpecialTab(envTabId('/a'))).toBe(true);
    expect(isSpecialTab('/a')).toBe(false);
  });
});

describe('activateTab', () => {
  it('syncs activeIdx for collection tabs', () => {
    addCollectionTab('/a');
    addCollectionTab('/b');
    activateTab('/b');
    expect(get(activeTabId)).toBe('/b');
    expect(get(activeIdx)).toBe(1);
  });

  it('leaves activeIdx alone for special tabs', () => {
    activateTab('/b');
    openSpecialTab('shortcuts');
    expect(get(activeTabId)).toBe('shortcuts');
    expect(get(activeIdx)).toBe(1);
  });
});

describe('closeTab', () => {
  it('falls back to the current collection when the active tab closes', () => {
    addCollectionTab('/a');
    activateTab('/a');
    openSpecialTab('shortcuts');
    closeTab('shortcuts');
    expect(get(activeTabId)).toBe('/a');
    expect(get(tabOrder)).toEqual(['/a']);
  });

  it('keeps the active tab when another tab closes', () => {
    addCollectionTab('/a');
    openSpecialTab('shortcuts');
    closeTab('/a');
    expect(get(activeTabId)).toBe('shortcuts');
  });
});

describe('moveTab', () => {
  it('reorders around the drop target', () => {
    tabOrder.set(['/a', '/b', 'shortcuts']);
    moveTab('shortcuts', '/a');
    expect(get(tabOrder)).toEqual(['shortcuts', '/a', '/b']);
  });

  it('ignores unknown ids and self-drops', () => {
    tabOrder.set(['/a', '/b']);
    moveTab('/a', '/a');
    moveTab('/nope', '/a');
    expect(get(tabOrder)).toEqual(['/a', '/b']);
  });
});

describe('openSpecialTab', () => {
  it('does not duplicate an already-open tab', () => {
    openSpecialTab('shortcuts');
    openSpecialTab('shortcuts');
    expect(get(tabOrder)).toEqual(['shortcuts']);
  });
});
