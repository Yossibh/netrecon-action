export type Severity = 'none' | 'info' | 'warning' | 'critical';

export const SEVERITY_ORDER: Record<Severity, number> = {
  none: 0,
  info: 1,
  warning: 2,
  critical: 3,
};

export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

export function meetsThreshold(observed: Severity, threshold: Severity): boolean {
  return SEVERITY_ORDER[observed] >= SEVERITY_ORDER[threshold];
}

/**
 * Subset of the netrecon /api/analyze report that we track for diffs.
 * Keep this minimal - each tracked field should be stable and meaningful.
 */
export interface TrackedSnapshot {
  input: string;
  fetchedAt: string;
  dns: {
    a: string[];
    aaaa: string[];
    mx: string[];
    ns: string[];
  };
  tls: {
    daysUntilExpiry: number | null;
    issuer: string | null;
    subjectCn: string | null;
  };
  http: {
    statusCode: number | null;
    finalUrl: string | null;
  };
  email: {
    spfPresent: boolean;
    dmarcPolicy: string | null;
  };
  cdn: {
    vendor: string | null;
  };
}

export interface StateFile {
  version: 1;
  updatedAt: string;
  sites: Record<string, TrackedSnapshot>;
}

export interface Change {
  field: string;
  before: unknown;
  after: unknown;
  severity: Severity;
  note?: string;
}

export interface SiteResult {
  input: string;
  ok: boolean;
  error?: string;
  snapshot?: TrackedSnapshot;
  changes: Change[];
  highestSeverity: Severity;
  firstRun: boolean;
}
