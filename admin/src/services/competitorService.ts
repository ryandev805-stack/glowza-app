export interface CompetitorProduct {
  title: string;
  price: number;
  url: string;
  image: string;
  source: string;
}

export interface CompetitorAnalysisResult {
  query: string;
  results: CompetitorProduct[];
}

export async function analyzeCompetitorPrices(query: string): Promise<CompetitorAnalysisResult> {
  const response = await fetch('/api/compare-prices', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Could not analyze prices');
  }
  return body as CompetitorAnalysisResult;
}
