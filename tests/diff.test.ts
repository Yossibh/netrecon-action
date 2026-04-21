import { describe, it, expect } from 'vitest';
import { diffSnapshots, highestSeverity } from '../src/diff';
import type { TrackedSnapshot } from '../src/types';

function baseSnap(): TrackedSnapshot {
  return {
    input: 'example.com',
    fetchedAt: '2026-01-01T00:00:00Z',
    dns: { a: ['1.2.3.4'], aaaa: [], mx: ['mx.example.com'], ns: ['ns1.example.com'] },
    tls: { daysUntilExpiry: 60, issuer: 'Lets Encrypt', subjectCn: 'example.com' },
    http: { statusCode: 200, finalUrl: 'https://example.com/' },
    email: { spfPresent: true, dmarcPolicy: 'reject' },
    cdn: { vendor: 'Cloudflare' },
    whois: { daysUntilExpiry: 365, registrar: 'Example Registrar', registrarLocked: true },
  };
}

describe('diffSnapshots whois', () => {
  it('flags domain expiring in <14 days as critical', () => {
    const b = baseSnap();
    const a = baseSnap();
    a.whois.daysUntilExpiry = 10;
    expect(highestSeverity(diffSnapshots(b, a))).toBe('critical');
  });
  it('flags domain expiring in 14-59 days as warning', () => {
    const b = baseSnap();
    const a = baseSnap();
    a.whois.daysUntilExpiry = 40;
    expect(highestSeverity(diffSnapshots(b, a))).toBe('warning');
  });
  it('flags registrar change as warning', () => {
    const b = baseSnap();
    const a = baseSnap();
    a.whois.registrar = 'Other Registrar';
    const changes = diffSnapshots(b, a);
    expect(changes.find((c) => c.field === 'whois.registrar')?.severity).toBe('warning');
  });
  it('flags registrar lock removal as critical', () => {
    const b = baseSnap();
    const a = baseSnap();
    a.whois.registrarLocked = false;
    const changes = diffSnapshots(b, a);
    expect(changes.find((c) => c.field === 'whois.registrarLocked')?.severity).toBe('critical');
  });
});

describe('diffSnapshots', () => {
  it('returns empty for identical snapshots', () => {
    expect(diffSnapshots(baseSnap(), baseSnap())).toEqual([]);
  });

  it('flags DNS A record change as warning', () => {
    const b = baseSnap();
    const a = baseSnap();
    a.dns.a = ['5.6.7.8'];
    const changes = diffSnapshots(b, a);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.field).toBe('dns.a');
    expect(changes[0]!.severity).toBe('warning');
  });

  it('flags TLS expiring in <14 days as critical', () => {
    const b = baseSnap();
    const a = baseSnap();
    a.tls.daysUntilExpiry = 10;
    expect(highestSeverity(diffSnapshots(b, a))).toBe('critical');
  });

  it('flags TLS expiring in 14-29 days as warning', () => {
    const b = baseSnap();
    const a = baseSnap();
    a.tls.daysUntilExpiry = 20;
    expect(highestSeverity(diffSnapshots(b, a))).toBe('warning');
  });

  it('flags DMARC weakening from reject to none as critical', () => {
    const b = baseSnap();
    const a = baseSnap();
    a.email.dmarcPolicy = 'none';
    const c = diffSnapshots(b, a).find((x) => x.field === 'email.dmarcPolicy')!;
    expect(c.severity).toBe('critical');
  });

  it('flags HTTP 200 -> 500 as critical', () => {
    const b = baseSnap();
    const a = baseSnap();
    a.http.statusCode = 500;
    expect(diffSnapshots(b, a).find((x) => x.field === 'http.statusCode')!.severity).toBe('critical');
  });

  it('flags CDN vendor change as warning', () => {
    const b = baseSnap();
    const a = baseSnap();
    a.cdn.vendor = 'Fastly';
    expect(diffSnapshots(b, a)[0]!.severity).toBe('warning');
  });

  it('detects SPF removal as critical', () => {
    const b = baseSnap();
    const a = baseSnap();
    a.email.spfPresent = false;
    expect(diffSnapshots(b, a).find((x) => x.field === 'email.spfPresent')!.severity).toBe('critical');
  });
});
