import type { TreeNode } from '../shared/types';

// Subsequence fuzzy match: every query char must appear in order.
export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// Prune the tree to nodes matching the query. A folder is kept if its own
// name matches (with all children) or if any descendant matches.
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query.trim()) return nodes;
  const out: TreeNode[] = [];
  for (const node of nodes) {
    if (fuzzyMatch(query, node.name)) {
      out.push(node);
      continue;
    }
    if (node.isFolder && node.children?.length) {
      const kept = filterTree(node.children, query);
      if (kept.length > 0) out.push({ ...node, children: kept });
    }
  }
  return out;
}
