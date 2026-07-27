// Shared wrapper for workspace operations: clears the error banner, runs
// the operation, and surfaces failures through the error store.

import { errMsg } from '../shared/errors';
import { error } from './state';

export async function runOp(fn: () => Promise<void>): Promise<void> {
  error.set('');
  try {
    await fn();
  } catch (e) {
    error.set(errMsg(e));
  }
}
