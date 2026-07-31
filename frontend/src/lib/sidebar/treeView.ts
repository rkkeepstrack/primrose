// Derived view-state for the sidebar tree: search filtering, the
// recent-only mode, recency heat and unsaved-edit markers.

import { derived, writable } from 'svelte/store';
import type { TreeNode } from '../shared/types';
import { filterTree } from './fuzzy';
import { RECENT_MAX, recentPaths, unsavedEdits } from '../shared/stores';
import { activeIdx, collections, dirty, selectedPath } from '../workspace/state';

export const search = writable('');
// incremented to ask the sidebar to focus its search field (menu Quick Open)
export const focusSearchSignal = writable(0);
export const recentFilterOn = writable(false);

// path of the item being renamed in place (F2 or the ⋮ menu), null when none
export const renamingPath = writable<string | null>(null);

// folder expansion state, shared by all tree levels
export const expanded = writable<Record<string, boolean>>({});

export function toggleFolder(path: string) {
  expanded.update((e) => ({ ...e, [path]: !e[path] }));
}

export function expandFolder(path: string) {
  expanded.update((e) => ({ ...e, [path]: true }));
}

// Folders opened automatically while hopping (⌥↑/⌥↓); they collapse again
// once the hop moves out of them. User-opened folders are never touched.
let autoExpanded = new Set<string>();

export function revealRequest(path: string, root: string) {
  const ancestors: string[] = [];
  let p = path;
  for (;;) {
    const i = p.lastIndexOf('/');
    if (i <= root.length) break;
    p = p.slice(0, i);
    ancestors.push(p);
  }
  expanded.update((e) => {
    const next = { ...e };
    for (const dir of [...autoExpanded]) {
      if (!ancestors.includes(dir)) {
        next[dir] = false;
        autoExpanded.delete(dir);
      }
    }
    for (const dir of ancestors) {
      if (!next[dir]) {
        next[dir] = true;
        autoExpanded.add(dir);
      }
    }
    return next;
  });
}

// while searching, every folder is force-expanded so matches stay visible
export const forceOpen = derived(search, ($s) => $s.trim().length > 0);

// reset the filter when switching collections
export function resetFilters() {
  search.set('');
  recentFilterOn.set(false);
}

function findRequestNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === path && !n.isFolder) return n;
    if (n.isFolder && n.children?.length) {
      const hit = findRequestNode(n.children, path);
      if (hit) return hit;
    }
  }
  return null;
}

export const visibleTree = derived(
  [collections, activeIdx, search, recentFilterOn, recentPaths],
  ([$collections, $activeIdx, $search, $recentOn, $recents]) => {
    const tree = $collections[$activeIdx]?.tree ?? [];
    if (!$recentOn) return filterTree(tree, $search);
    // flat list of the recent requests, chronological (newest first)
    const flat = $recents.map((p) => findRequestNode(tree, p)).filter((n): n is TreeNode => n !== null);
    return filterTree(flat, $search);
  },
);

// the visible requests flattened depth-first — the order ⌥↑/⌥↓ hop in and
// what Enter in the search opens (first entry)
export const flatRequests = derived(visibleTree, ($tree) => {
  const out: TreeNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.isFolder) walk(n.children ?? []);
      else out.push(n);
    }
  };
  walk($tree);
  return out;
});

// path -> 0..1 recency rank (1 = most recent)
export const heat = derived(recentPaths, ($recents) => Object.fromEntries($recents.map((p, i) => [p, (RECENT_MAX - i) / RECENT_MAX])));

// True heatmap semantics: warm when fresh, cooling with age.
// Newest = orange (35°, blending into the yellow/orange selection), aging
// through coral/pink/purple/blue to teal (190°). Intensity fades linearly
// so the oldest entry melts into the white background.
export function heatStyle(rank: number | undefined): string {
  if (!rank) return '';
  const hue = (395 - (1 - rank) * 205) % 360;
  const alpha = 0.11 * rank;
  // a custom property (not `background` directly) so the row's :hover rule
  // still wins — inline backgrounds would override it
  return `--heat-bg: hsla(${hue.toFixed(0)}, 80%, 52%, ${alpha.toFixed(3)})`;
}

// paths with unsaved edits (stashed or currently open)
export const dirtyPaths = derived(
  [unsavedEdits, dirty, selectedPath],
  ([$edits, $dirty, $path]) => new Set(Object.keys($edits).concat($dirty && $path ? [$path] : [])),
);
