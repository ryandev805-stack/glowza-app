import type { Product } from '../types';

export type ScrapedProduct = Partial<Product> & {
  sourceUrl?: string;
};

export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  const response = await fetch('/api/scrape-product', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Could not scrape product');
  }
  return body as ScrapedProduct;
}
