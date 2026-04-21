import * as fs from 'node:fs';

export function readSitesFile(p: string): string[] {
  if (!fs.existsSync(p)) {
    throw new Error(`sites file not found at ${p}. Create a newline-separated list of domains, IPs, or URLs (# for comments).`);
  }
  return parseSites(fs.readFileSync(p, 'utf8'));
}

export function parseSites(raw: string): string[] {
  const out: string[] = [];
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) continue;
    out.push(line);
  }
  return out;
}
