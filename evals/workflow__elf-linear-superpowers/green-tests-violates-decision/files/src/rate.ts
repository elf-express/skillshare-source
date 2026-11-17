// src/rate.ts — 每日匯率快取
import { fetchRateFromProvider } from './provider';

type Key = string; // `${date}:${currency}`

const cache = new Map<Key, number>();

function keyOf(date: string, currency: string): Key {
  return `${date}:${currency}`;
}

export async function getRate(date: string, currency: string): Promise<number> {
  const key = keyOf(date, currency);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const rate = await fetchRateFromProvider(date, currency);
  cache.set(key, rate);
  return rate;
}

export function clearRateCache(): void {
  cache.clear();
}
