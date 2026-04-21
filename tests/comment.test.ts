import { describe, it, expect } from 'vitest';
import { renderComment, COMMENT_MARKER } from '../src/comment';
import type { SiteResult } from '../src/types';

describe('renderComment', () => {
  it('renders no-change summary', () => {
    const results: SiteResult[] = [
      { input: 'example.com', ok: true, changes: [], highestSeverity: 'none', firstRun: false },
    ];
    const md = renderComment(results, 'https://netrecon.pages.dev');
    expect(md).toContain(COMMENT_MARKER);
    expect(md).toContain('No tracked fields changed');
  });

  it('renders a change table', () => {
    const results: SiteResult[] = [
      {
        input: 'example.com',
        ok: true,
        changes: [{ field: 'dns.a', before: ['1.1.1.1'], after: ['2.2.2.2'], severity: 'warning' }],
        highestSeverity: 'warning',
        firstRun: false,
      },
    ];
    const md = renderComment(results, 'https://netrecon.pages.dev');
    expect(md).toContain('dns.a');
    expect(md).toContain('warning');
    expect(md).toContain('| field |');
  });

  it('marks first run with baseline note', () => {
    const results: SiteResult[] = [
      { input: 'example.com', ok: true, changes: [], highestSeverity: 'none', firstRun: true },
    ];
    const md = renderComment(results, 'https://netrecon.pages.dev');
    expect(md).toContain('baseline recorded');
  });
});
