import { useState, useEffect, useRef } from 'react';
import { analyzeCompetitorPrices } from '../services/competitorService';
import type { CompetitorProduct } from '../services/competitorService';
import { AlertCircle, ExternalLink, Image, Loader2, Search, Sparkles, X } from 'lucide-react';

interface CompetitorPriceModalProps {
  productTitle: string;
  productImage?: string;
  baseCost: number;
  currentPrice: number;
  onApply: (newPrice: number, oldPrice: number) => void;
  onClose: () => void;
}

type SearchMode = 'text' | 'image' | 'both';

export function CompetitorPriceModal({
  productTitle,
  productImage,
  baseCost,
  currentPrice,
  onApply,
  onClose,
}: CompetitorPriceModalProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompetitorProduct[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>(productImage ? 'both' : 'text');
  const [hasSearched, setHasSearched] = useState(false);

  // Pricing states
  const [cost, setCost] = useState(baseCost || 0);
  const [profitMargin, setProfitMargin] = useState(300);
  const [marginType, setMarginType] = useState<'flat' | 'percent'>('flat');

  const abortRef = useRef<AbortController | null>(null);

  // Auto-search on open
  useEffect(() => {
    runSearch();
    return () => abortRef.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(modeOverride?: SearchMode) {
    const mode = modeOverride ?? searchMode;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError('');
    setNotice('');
    setResults([]);
    setHasSearched(false);

    try {
      const params: { query?: string; imageUrl?: string } = {};
      if (mode === 'text' || mode === 'both') params.query = productTitle;
      if ((mode === 'image' || mode === 'both') && productImage) params.imageUrl = productImage;

      const data = await analyzeCompetitorPrices(params);
      setResults(data.results);
      const imageRequested = mode !== 'text' && Boolean(productImage);
      const imageMatches = Number(data.diagnostics?.imageMatches || 0);
      if (imageRequested && data.diagnostics?.imageProviderConfigured === false) {
        setNotice('Image search needs SERPAPI_API_KEY in Vercel. Showing title-based marketplace results for now.');
      } else if (imageRequested && imageMatches === 0) {
        setNotice('No visual matches were returned for this image. Title-based marketplace matches are shown below.');
      }
      setHasSearched(true);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to retrieve competitor listings');
    } finally {
      setLoading(false);
    }
  }

  // Re-run search when mode changes (only after initial search)
  function changeMode(mode: SearchMode) {
    setSearchMode(mode);
  }

  function changeModeAndSearch(mode: SearchMode) {
    setSearchMode(mode);
    void runSearch(mode);
  }

  const prices = results.map(r => r.price).filter(p => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

  const suggestedPrice = Math.ceil(
    marginType === 'flat' ? cost + profitMargin : cost * (1 + profitMargin / 100)
  );
  const suggestedOldPrice = Math.ceil(suggestedPrice / 0.6);

  let statusText = 'No competitor matches yet';
  let statusClass = 'status-warning';
  if (prices.length > 0) {
    if (suggestedPrice < minPrice) {
      statusText = '🟢 Highly Competitive — Lower than all found prices';
      statusClass = 'status-success';
    } else if (suggestedPrice <= avgPrice) {
      statusText = '🔵 Competitive — Around market average';
      statusClass = 'status-info';
    } else {
      statusText = '🔴 High Pricing — Above competitor average';
      statusClass = 'status-danger';
    }
  }

  function handleSave() {
    onApply(suggestedPrice, suggestedOldPrice);
    onClose();
  }

  const modeDisabled = loading;
  const canSearchByImage = Boolean(productImage);

  return (
    <div className="modal-backdrop">
      <div className="modal-container price-optimizer-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <span className="eyebrow flex-row"><Sparkles size={13} /> Pricing Intelligence</span>
            <h2>Competitor Price Optimizer</h2>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Search mode switcher */}
        <div className="search-mode-bar">
          <div className="search-mode-tabs">
            <button
              type="button"
              disabled={modeDisabled}
              className={searchMode === 'text' ? 'active' : ''}
              onClick={() => changeModeAndSearch('text')}
            >
              <Search size={13} /> Text Search
            </button>
            {canSearchByImage && (
              <>
                <button
                  type="button"
                  disabled={modeDisabled}
                  className={searchMode === 'image' ? 'active' : ''}
                  onClick={() => changeModeAndSearch('image')}
                >
                  <Image size={13} /> Image Search
                </button>
                <button
                  type="button"
                  disabled={modeDisabled}
                  className={searchMode === 'both' ? 'active' : ''}
                  onClick={() => changeModeAndSearch('both')}
                >
                  <Sparkles size={13} /> Both
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            className="ghost run-search-btn"
            disabled={loading}
            onClick={() => void runSearch()}
          >
            {loading ? <Loader2 size={14} className="spinner" /> : <Search size={14} />}
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="modal-content-grid">
          {/* Left panel: Search results */}
          <div className="competitors-section">

            {/* Image preview (when image mode active) */}
            {(searchMode === 'image' || searchMode === 'both') && productImage && (
              <div className="image-search-preview">
                <img src={productImage} alt={productTitle} />
                <div className="image-search-label">
                  <Image size={12} />
                  <span>Searching by product image</span>
                </div>
              </div>
            )}

            <div className="section-header-compact">
              <h3>Competitor Matches</h3>
              <p className="query-pill">
                {searchMode === 'text' && <>Text: <em>"{productTitle}"</em></>}
                {searchMode === 'image' && <><Image size={11} /> Reverse image search</>}
                {searchMode === 'both' && <><Sparkles size={11} /> Text + Image combined</>}
              </p>
            </div>

            {loading && (
              <div className="modal-state-container">
                <Loader2 className="spinner" size={28} />
                <p>
                  {searchMode === 'image'
                    ? 'Running reverse image search across e-commerce sites...'
                    : searchMode === 'both'
                      ? 'Scanning by title + image simultaneously...'
                      : 'Scanning Pakistani e-commerce platforms...'}
                </p>
              </div>
            )}

            {error && (
              <div className="error-alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {notice && !error && (
              <div className="info-alert">
                <AlertCircle size={16} />
                <span>{notice}</span>
              </div>
            )}

            {!loading && hasSearched && results.length === 0 && (
              <div className="empty-state-card">
                <AlertCircle size={24} />
                <p>No matching listings found on competitor stores.</p>
                {searchMode === 'text' && canSearchByImage && (
                  <button type="button" className="ghost" style={{ marginTop: 8 }}
                    onClick={() => changeModeAndSearch('both')}>
                    <Image size={14} /> Try image search too
                  </button>
                )}
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="competitor-list">
                {results.map((item, idx) => (
                  <div key={idx} className={`competitor-item ${item.foundBy === 'image' ? 'from-image' : ''}`}>
                    {item.image && (
                      <img src={item.image} alt="" className="competitor-thumb" />
                    )}
                    <div className="competitor-info">
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className={`source-tag tag-${item.source.toLowerCase().replace(/\s+/g, '-')}`}>
                          {item.source}
                        </span>
                        {item.foundBy === 'image' && (
                          <span className="found-by-image-tag"><Image size={9} /> via image</span>
                        )}
                      </div>
                      <p className="item-title" title={item.title}>{item.title}</p>
                    </div>
                    <div className="competitor-pricing">
                      {item.price > 0
                        ? <strong>PKR {item.price.toLocaleString('en-PK')}</strong>
                        : <span className="no-price">Price N/A</span>}
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer" className="external-link" title="Open listing">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Statistics */}
            {prices.length > 0 && (
              <div className="price-stats-grid">
                <div className="stat-card">
                  <span>Min Price</span>
                  <strong>PKR {minPrice.toLocaleString()}</strong>
                </div>
                <div className="stat-card highlight">
                  <span>Avg Price</span>
                  <strong>PKR {avgPrice.toLocaleString()}</strong>
                </div>
                <div className="stat-card">
                  <span>Max Price</span>
                  <strong>PKR {maxPrice.toLocaleString()}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Margin calculator */}
          <div className="calculator-section">
            <h3>Profit &amp; Margin Builder</h3>

            <div className="calculator-inputs">
              <label>
                Supplier Cost (PKR)
                <input
                  type="number"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                />
              </label>

              <div className="margin-selector-row">
                <span>Margin Type</span>
                <div className="toggle-group">
                  <button
                    type="button"
                    onClick={() => { setMarginType('flat'); setProfitMargin(300); }}
                    className={marginType === 'flat' ? 'active' : ''}>
                    PKR Profit
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMarginType('percent'); setProfitMargin(30); }}
                    className={marginType === 'percent' ? 'active' : ''}>
                    Markup %
                  </button>
                </div>
              </div>

              <label>
                {marginType === 'flat' ? 'Profit Amount (PKR)' : 'Markup Margin (%)'}
                <input
                  type="number"
                  min="0"
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="calculations-summary">
              <div className="calc-row">
                <span>Supplier Cost:</span>
                <span>PKR {cost.toLocaleString()}</span>
              </div>
              <div className="calc-row">
                <span>Markup:</span>
                <span>{marginType === 'flat' ? `PKR ${profitMargin.toLocaleString()}` : `${profitMargin}%`}</span>
              </div>
              <div className="divider"></div>
              <div className="calc-row highlight">
                <span>Recommended Retail:</span>
                <strong>PKR {suggestedPrice.toLocaleString()}</strong>
              </div>
              <div className="calc-row subtext">
                <span>Old Price (40% off display):</span>
                <span className="strike">PKR {suggestedOldPrice.toLocaleString()}</span>
              </div>
            </div>

            {hasSearched && (
              <div className={`competitiveness-badge ${statusClass}`}>
                {statusText}
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              className="apply-pricing-btn">
              Apply Optimized Pricing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
