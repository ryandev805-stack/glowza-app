export interface CompetitorProduct {
  title: string;
  price: number;
  url: string;
  image: string;
  source: string;
  relevance?: number;
  foundBy?: 'text' | 'image';
}

export interface CompetitorAnalysisResult {
  query: string;
  imageUrl?: string | null;
  total: number;
  results: CompetitorProduct[];
}

export interface CompetitorSearchParams {
  query?: string;
  imageUrl?: string;
  limit?: number;
}

export async function analyzeCompetitorPrices(
  params: CompetitorSearchParams,
): Promise<CompetitorAnalysisResult> {
  const response = await fetch('/api/compare-prices', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Could not analyze prices');
  }
  return body as CompetitorAnalysisResult;
}
