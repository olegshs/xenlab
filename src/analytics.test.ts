import { describe, expect, it } from 'vitest';
import { cookieDomains, isMeasurementId, track } from './analytics';

// These tests must not depend on VITE_GA_ID: the Docker build runs them with the real ID set.
describe('analytics', () => {
  it('accepts only GA4 measurement IDs', () => {
    expect(isMeasurementId('G-T1LF3428N0')).toBe(true);
    expect(isMeasurementId('')).toBe(false);
    expect(isMeasurementId('GTM-WK7H39J6')).toBe(false);
    expect(isMeasurementId('UA-12345-1')).toBe(false);
    expect(isMeasurementId('G-abc"onload')).toBe(false);
  });

  it('does not throw when tracking before consent', () => {
    expect(() => track('test_event', { a: 1 })).not.toThrow();
  });

  it('lists every domain a GA cookie may be set on', () => {
    expect(cookieDomains('localhost')).toEqual(['']);
    expect(cookieDomains('example.com')).toEqual(['', '.example.com']);
    expect(cookieDomains('xenlab.example.co.uk')).toEqual(['', '.xenlab.example.co.uk', '.example.co.uk', '.co.uk']);
  });
});
