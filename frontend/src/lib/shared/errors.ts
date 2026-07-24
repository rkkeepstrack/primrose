// Wails rejections are usually plain strings; JS failures are Errors.
// String(e) on an Error yields "Error: msg" — this keeps just the message.
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
