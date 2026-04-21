import type { SiteResult, Severity } from './types.js';

export const COMMENT_MARKER = '<!-- netrecon-action:v1 -->';

const SEV_ICON: Record<Severity, string> = {
  none: '✅',
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🚨',
};

export function renderComment(results: SiteResult[], apiBase: string): string {
  const lines: string[] = [];
  lines.push(COMMENT_MARKER);
  lines.push('## netrecon report');
  lines.push('');

  const anyChange = results.some((r) => r.changes.length > 0);
  const anyError = results.some((r) => !r.ok);
  const firstRuns = results.filter((r) => r.firstRun && r.ok).length;

  if (anyError) {
    const errs = results.filter((r) => !r.ok);
    lines.push(`**${errs.length} site(s) failed to fetch.**`);
  }
  if (firstRuns > 0) {
    lines.push(`🌱 ${firstRuns} site(s) on first run — baseline recorded, no diffs yet.`);
  }
  if (!anyChange && !anyError && firstRuns === 0) {
    lines.push('✅ No tracked fields changed for any site.');
    lines.push('');
    appendSitesList(lines, results);
    lines.push('');
    lines.push(`_${isoShort(new Date())} · powered by [netrecon](${apiBase})_`);
    return lines.join('\n');
  }

  for (const r of results) {
    if (!r.ok) {
      lines.push(`### 🚨 \`${r.input}\``);
      lines.push(`- fetch error: ${r.error}`);
      lines.push('');
      continue;
    }
    if (r.firstRun) {
      lines.push(`### 🌱 \`${r.input}\` — baseline recorded`);
      lines.push('');
      continue;
    }
    if (r.changes.length === 0) {
      lines.push(`### ✅ \`${r.input}\` — no change`);
      lines.push('');
      continue;
    }
    lines.push(`### ${SEV_ICON[r.highestSeverity]} \`${r.input}\` — ${r.changes.length} change(s)`);
    lines.push('');
    lines.push('| field | before | after | severity |');
    lines.push('|---|---|---|---|');
    for (const c of r.changes) {
      lines.push(`| \`${c.field}\` | ${fmt(c.before)} | ${fmt(c.after)} | ${SEV_ICON[c.severity]} ${c.severity} |`);
    }
    lines.push('');
  }

  lines.push(`_${isoShort(new Date())} · powered by [netrecon](${apiBase})_`);
  return lines.join('\n');
}

function appendSitesList(lines: string[], results: SiteResult[]) {
  lines.push('<details><summary>Sites checked</summary>');
  lines.push('');
  for (const r of results) lines.push(`- \`${r.input}\``);
  lines.push('');
  lines.push('</details>');
}

function fmt(v: unknown): string {
  if (v == null) return '_null_';
  if (Array.isArray(v)) return v.length === 0 ? '_empty_' : '`' + v.join(', ') + '`';
  if (typeof v === 'string') return v.length === 0 ? '_empty_' : '`' + v + '`';
  return '`' + String(v) + '`';
}

function isoShort(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
