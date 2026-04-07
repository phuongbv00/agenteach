import os from 'os';
import path from 'path';

/**
 * Returns the app data root: ~/.agenteach on all platforms.
 * On Windows this resolves to C:\Users\<user>\.agenteach
 */
export function dataDir(...segments: string[]): string {
  return path.join(os.homedir(), '.agenteach', ...segments);
}
