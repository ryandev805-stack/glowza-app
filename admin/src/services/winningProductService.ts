import type { WinningProductCandidate } from '../types';

export type WinningProductScanInput = {
  categoryUrl: string;
  maxProducts: number;
  minPrice: number;
  maxPrice: number;
};

export async function scanWinningProducts(
  input: WinningProductScanInput,
): Promise<WinningProductCandidate[]> {
  const response = await fetch('/api/scan-winning-products', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Could not scan winning products');
  }
  return body.products as WinningProductCandidate[];
}
