import type { TrackedSnapshot } from './types.js';

export interface AnalyzeOptions {
  apiBase: string;
  input: string;
  timeoutMs?: number;
}

export async function analyzeOne(opts: AnalyzeOptions): Promise<TrackedSnapshot> {
  const url = `${opts.apiBase.replace(/\/+$/, '')}/api/analyze?input=${encodeURIComponent(opts.input)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  let raw: unknown;
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'application/json', 'user-agent': 'netrecon-action/1.0' },
    });
    if (!res.ok) throw new Error(`analyze ${opts.input}: HTTP ${res.status}`);
    raw = await res.json();
  } finally {
    clearTimeout(t);
  }
  return extractSnapshot(opts.input, raw);
}

export function extractSnapshot(input: string, raw: unknown): TrackedSnapshot {
  const r = (raw ?? {}) as Record<string, any>;
  const dns = (r.dns ?? {}) as Record<string, any>;
  const tls = (r.tls ?? {}) as Record<string, any>;
  const http = (r.http ?? {}) as Record<string, any>;
  const email = (r.email ?? {}) as Record<string, any>;
  const cdn = (r.cdn ?? {}) as Record<string, any>;

  const sortStr = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const x of v) {
      if (typeof x === 'string') out.push(x);
      else if (x && typeof x === 'object' && 'value' in x && typeof (x as any).value === 'string') {
        out.push((x as any).value);
      }
    }
    return out.sort();
  };

  const statusCode = http?.status?.code;
  const finalUrl = http?.status?.finalUrl ?? http?.finalUrl;

  return {
    input,
    fetchedAt: new Date().toISOString(),
    dns: {
      a: sortStr(dns.a ?? dns.A ?? dns.records?.A),
      aaaa: sortStr(dns.aaaa ?? dns.AAAA ?? dns.records?.AAAA),
      mx: sortStr(dns.mx ?? dns.MX ?? dns.records?.MX),
      ns: sortStr(dns.ns ?? dns.NS ?? dns.records?.NS),
    },
    tls: {
      daysUntilExpiry: typeof tls.daysUntilExpiry === 'number' ? tls.daysUntilExpiry : null,
      issuer: typeof tls.issuer === 'string' ? tls.issuer : (tls.issuer?.CN ?? null),
      subjectCn: typeof tls.subjectCn === 'string' ? tls.subjectCn : (tls.subject?.CN ?? null),
    },
    http: {
      statusCode: typeof statusCode === 'number' ? statusCode : null,
      finalUrl: typeof finalUrl === 'string' ? finalUrl : null,
    },
    email: {
      spfPresent: Boolean(email?.spf?.present ?? email?.spf?.record),
      dmarcPolicy: email?.dmarc?.policy ?? null,
    },
    cdn: {
      vendor: cdn?.vendor ?? cdn?.name ?? null,
    },
  };
}
