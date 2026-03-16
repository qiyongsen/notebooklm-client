import { describe, it, expect, vi } from 'vitest';
import { detectBestTier, TIER_LABELS } from '../src/transport-resolver.js';
import { CurlTransport } from '../src/transport-curl.js';
import { TlsClientTransport } from '../src/transport-tlsclient.js';

describe('transport-resolver', () => {
  it('should prefer curl-impersonate when available', async () => {
    vi.spyOn(CurlTransport, 'isAvailable').mockResolvedValue(true);
    vi.spyOn(TlsClientTransport, 'isAvailable').mockResolvedValue(true);

    const tier = await detectBestTier();
    expect(tier).toBe('curl-impersonate');

    vi.restoreAllMocks();
  });

  it('should fall back to tls-client when curl unavailable', async () => {
    vi.spyOn(CurlTransport, 'isAvailable').mockResolvedValue(false);
    vi.spyOn(TlsClientTransport, 'isAvailable').mockResolvedValue(true);

    const tier = await detectBestTier();
    expect(tier).toBe('tls-client');

    vi.restoreAllMocks();
  });

  it('should fall back to http when nothing else available', async () => {
    vi.spyOn(CurlTransport, 'isAvailable').mockResolvedValue(false);
    vi.spyOn(TlsClientTransport, 'isAvailable').mockResolvedValue(false);

    const tier = await detectBestTier();
    expect(tier).toBe('http');

    vi.restoreAllMocks();
  });

  it('should have labels for all tiers', () => {
    expect(TIER_LABELS['curl-impersonate']).toContain('100%');
    expect(TIER_LABELS['tls-client']).toContain('99%');
    expect(TIER_LABELS['http']).toContain('tier 3');
  });
});
