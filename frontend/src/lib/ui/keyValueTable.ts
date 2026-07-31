// Row model helpers for KeyValueEditor: rows keep their identity while keys
// are edited, entries are the emitted map form.

export type Row = { key: string; value: string };

export function toRows(entries: Record<string, string>): Row[] {
  return Object.entries(entries).map(([key, value]) => ({ key, value }));
}

// rows with empty keys are drafts and stay out of the emitted entries
export function toEntries(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.key.trim() !== '') out[r.key] = r.value;
  }
  return out;
}

// duplicate keys would silently collapse (last one wins on emit) — flag them
export function findDuplicateKeys(rows: Row[]): Set<string> {
  const keys = rows.map((r) => r.key);
  return new Set(keys.filter((k, i) => k.trim() !== '' && keys.indexOf(k) !== i));
}
