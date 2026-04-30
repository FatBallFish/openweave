import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertPortalUrlAllowed } from '../../../src/shared/portal/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('assertPortalUrlAllowed', () => {
  it('normalizes valid http and https URLs', () => {
    expect(assertPortalUrlAllowed(' https://example.com/demo ')).toBe('https://example.com/demo');
    expect(assertPortalUrlAllowed('http://127.0.0.1:3000/test')).toBe('http://127.0.0.1:3000/test');
  });

  it('defaults bare domain portal URLs to https', () => {
    expect(assertPortalUrlAllowed('www.google.com')).toBe('https://www.google.com/');
    expect(assertPortalUrlAllowed('baidu.com')).toBe('https://baidu.com/');
  });

  it('rejects missing, malformed, and disallowed URLs', () => {
    expect(() => assertPortalUrlAllowed('   ')).toThrow('Portal URL is required');
    expect(() => assertPortalUrlAllowed('not-a-url')).toThrow('Portal URL is invalid');
    expect(() => assertPortalUrlAllowed('file:///tmp/demo.html')).toThrow('URL scheme not allowed');

    vi.stubGlobal(
      'URL',
      class MockURL {
        public readonly protocol = 'https:';
        public readonly hostname = '';

        public constructor(_value: string) {}

        public toString(): string {
          return 'https:///missing-host';
        }
      } as unknown as typeof URL
    );
    expect(() => assertPortalUrlAllowed('https:///missing-host')).toThrow('Portal URL host is required');
  });
});
