import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StateFile, TrackedSnapshot } from './types.js';

export function readState(statePath: string): StateFile | null {
  try {
    const buf = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(buf) as StateFile;
    if (parsed && parsed.version === 1 && parsed.sites) return parsed;
    return null;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') return null;
    throw err;
  }
}

export function writeState(statePath: string, snapshots: Record<string, TrackedSnapshot>): StateFile {
  const state: StateFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    sites: snapshots,
  };
  const dir = path.dirname(statePath);
  if (dir && dir !== '.' && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return state;
}
