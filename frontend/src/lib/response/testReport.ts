import type { TestReport } from '../shared/types';

// The tests tab badge: "passed/total", green only when nothing failed.
export function testBadge(r: TestReport): { text: string; ok: boolean } {
  return { text: `${r.passed}/${r.total}`, ok: r.passed === r.total };
}
