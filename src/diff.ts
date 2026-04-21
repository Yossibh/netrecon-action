import type { Change, Severity, TrackedSnapshot } from './types.js';
import { maxSeverity } from './types.js';

export function diffSnapshots(before: TrackedSnapshot, after: TrackedSnapshot): Change[] {
  const changes: Change[] = [];

  arrayDiff(changes, 'dns.a', before.dns.a, after.dns.a, 'warning');
  arrayDiff(changes, 'dns.aaaa', before.dns.aaaa, after.dns.aaaa, 'warning');
  arrayDiff(changes, 'dns.mx', before.dns.mx, after.dns.mx, 'warning');
  arrayDiff(changes, 'dns.ns', before.dns.ns, after.dns.ns, 'warning');

  if (before.tls.daysUntilExpiry !== after.tls.daysUntilExpiry) {
    let sev: Severity = 'info';
    const a = after.tls.daysUntilExpiry;
    if (a != null) {
      if (a < 14) sev = 'critical';
      else if (a < 30) sev = 'warning';
    }
    changes.push({
      field: 'tls.daysUntilExpiry',
      before: before.tls.daysUntilExpiry,
      after: after.tls.daysUntilExpiry,
      severity: sev,
      note: a != null && a < 14 ? 'cert expires in <14d' : undefined,
    });
  }

  scalar(changes, 'tls.issuer', before.tls.issuer, after.tls.issuer, 'warning');
  scalar(changes, 'tls.subjectCn', before.tls.subjectCn, after.tls.subjectCn, 'info');

  if (before.http.statusCode !== after.http.statusCode) {
    const b = before.http.statusCode;
    const a = after.http.statusCode;
    let sev: Severity = 'info';
    const goodBefore = b != null && b >= 200 && b < 400;
    const badAfter = a == null || a >= 500;
    if (goodBefore && badAfter) sev = 'critical';
    else if (b !== a) sev = 'warning';
    changes.push({ field: 'http.statusCode', before: b, after: a, severity: sev });
  }
  scalar(changes, 'http.finalUrl', before.http.finalUrl, after.http.finalUrl, 'info');

  if (before.email.dmarcPolicy !== after.email.dmarcPolicy) {
    const b = (before.email.dmarcPolicy ?? '').toLowerCase();
    const a = (after.email.dmarcPolicy ?? '').toLowerCase();
    let sev: Severity = 'warning';
    const strong = new Set(['quarantine', 'reject']);
    if (strong.has(b) && !strong.has(a)) sev = 'critical';
    changes.push({ field: 'email.dmarcPolicy', before: before.email.dmarcPolicy, after: after.email.dmarcPolicy, severity: sev });
  }
  if (before.email.spfPresent !== after.email.spfPresent) {
    changes.push({
      field: 'email.spfPresent',
      before: before.email.spfPresent,
      after: after.email.spfPresent,
      severity: before.email.spfPresent && !after.email.spfPresent ? 'critical' : 'warning',
    });
  }

  scalar(changes, 'cdn.vendor', before.cdn.vendor, after.cdn.vendor, 'warning');

  return changes;
}

export function highestSeverity(changes: Change[]): Severity {
  let s: Severity = 'none';
  for (const c of changes) s = maxSeverity(s, c.severity);
  return s;
}

function arrayDiff(out: Change[], field: string, b: string[], a: string[], sev: Severity) {
  if (JSON.stringify(b) !== JSON.stringify(a)) out.push({ field, before: b, after: a, severity: sev });
}

function scalar(out: Change[], field: string, b: unknown, a: unknown, sev: Severity) {
  if (b !== a) out.push({ field, before: b, after: a, severity: sev });
}
