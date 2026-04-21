import { describe, it, expect } from 'vitest';
import { extractSnapshot } from '../src/analyze';

describe('extractSnapshot', () => {
  it('handles a well-formed report', () => {
    const raw = {
      dns: { a: ['1.2.3.4'], aaaa: [], mx: [{ value: '10 mx.example.com' }], ns: ['ns1.example.com'] },
      tls: { daysUntilExpiry: 42, issuer: { CN: 'R10' }, subject: { CN: 'example.com' } },
      http: { status: { code: 200, finalUrl: 'https://example.com/' } },
      email: { spf: { present: true }, dmarc: { policy: 'reject' } },
      cdn: { vendor: 'Cloudflare' },
    };
    const s = extractSnapshot('example.com', raw);
    expect(s.dns.a).toEqual(['1.2.3.4']);
    expect(s.dns.mx).toEqual(['10 mx.example.com']);
    expect(s.tls.daysUntilExpiry).toBe(42);
    expect(s.tls.issuer).toBe('R10');
    expect(s.http.statusCode).toBe(200);
    expect(s.email.dmarcPolicy).toBe('reject');
    expect(s.cdn.vendor).toBe('Cloudflare');
  });

  it('degrades gracefully for empty report', () => {
    const s = extractSnapshot('x.y', {});
    expect(s.dns.a).toEqual([]);
    expect(s.tls.daysUntilExpiry).toBeNull();
    expect(s.http.statusCode).toBeNull();
    expect(s.email.spfPresent).toBe(false);
    expect(s.cdn.vendor).toBeNull();
  });

  it('sorts DNS arrays for stable diffs', () => {
    const s = extractSnapshot('x.y', { dns: { a: ['9.9.9.9', '1.1.1.1'] } });
    expect(s.dns.a).toEqual(['1.1.1.1', '9.9.9.9']);
  });
});
