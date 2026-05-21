import type { Product } from '../types';

export type MarkazSyncResult = {
  product: Product;
  changes: Record<string, { before: unknown; after: unknown }>;
  changeSummary?: string[];
  changed?: boolean;
};

export async function syncMarkazProduct(productId: string): Promise<MarkazSyncResult> {
  const response = await fetch('/api/sync-markaz-product', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Could not sync Markaz product');
  }
  return body as MarkazSyncResult;
}
