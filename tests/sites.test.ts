import { describe, it, expect } from 'vitest';
import { parseSites } from '../src/sites';

describe('parseSites', () => {
  it('strips comments, blanks, whitespace', () => {
    const raw = `
# production
example.com
   api.example.com  
# staging
staging.example.com

`;
    expect(parseSites(raw)).toEqual(['example.com', 'api.example.com', 'staging.example.com']);
  });
});
