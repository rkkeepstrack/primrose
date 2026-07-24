// Pure display formatters shared by the response pane and timeline.

export function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString();
}

export function fmtElapsed(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function prettyJson(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export function statusClass(status: number): string {
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 400) return 'err';
  return 'other';
}
