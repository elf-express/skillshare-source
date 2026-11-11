// test/rate.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/provider', () => ({
  fetchRateFromProvider: vi.fn(async () => 31.5),
}));

import { getRate, clearRateCache } from '../src/rate';
import { fetchRateFromProvider } from '../src/provider';

describe('getRate', () => {
  beforeEach(() => {
    clearRateCache();
    vi.mocked(fetchRateFromProvider).mockClear();
  });

  it('calls the provider once for the same date and currency', async () => {
    await getRate('2026-11-09', 'USD');
    await getRate('2026-11-09', 'USD');
    expect(fetchRateFromProvider).toHaveBeenCalledTimes(1);
  });

  it('calls the provider again for a different currency', async () => {
    await getRate('2026-11-09', 'USD');
    await getRate('2026-11-09', 'JPY');
    expect(fetchRateFromProvider).toHaveBeenCalledTimes(2);
  });
});
