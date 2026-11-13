import { describe, expect, it } from 'vitest';
import { ANALYTICS_ENABLED, cookieDomains, track } from './analytics';

describe('analytics', () => {
  it('is off without a measurement ID', () => {
    expect(ANALYTICS_ENABLED).toBe(false);
    expect(() => track('test_event', { a: 1 })).not.toThrow();
  });

  it('lists every domain a GA cookie may be set on', () => {
    expect(cookieDomains('localhost')).toEqual(['']);
    expect(cookieDomains('example.com')).toEqual(['', '.example.com']);
    expect(cookieDomains('xenlab.example.co.uk')).toEqual(['', '.xenlab.example.co.uk', '.example.co.uk', '.co.uk']);
  });
});
