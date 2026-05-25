import { useState, useEffect } from 'react';
import { analyzeCompetitorPrices } from '../services/competitorService';
import type { CompetitorProduct } from '../services/competitorService';
import { AlertCircle, ExternalLink, Loader2, Sparkles, X } from 'lucide-react';

interface CompetitorPriceModalProps {
  productTitle: string;
  baseCost: number;
  currentPrice: number;
  onApply: (newPrice: number, oldPrice: number) => void;
  onClose: () => void;
}

export function CompetitorPriceModal({
  productTitle,
  baseCost,
  currentPrice,
  onApply,
  onClose,
}: CompetitorPriceModalProps) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<CompetitorProduct[]>([]);
  const [error, setError] = useState('');
  
  // Pricing states
  const [cost, setCost] = useState(baseCost || 0);
  const [profitMargin, setProfitMargin] = useState(300);
  const [marginType, setMarginType] = useState<'flat' | 'percent'>('flat');
  
  useEffect(() => {
    async function fetchPrices() {
      try {
        setLoading(true);
        setError('');
        const data = await analyzeCompetitorPrices(productTitle);
        setResults(data.results);
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve competitor listings');
      } finally {
        setLoading(false);
      }
    }
    if (productTitle) {
      fetchPrices();
    }
  }, [productTitle]);

  const prices = results.map(r => r.price);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

  const suggestedPrice = Math.ceil(
    marginType === 'flat' ? cost + profitMargin : cost * (1 + profitMargin / 100)
  );

  const suggestedOldPrice = Math.ceil(suggestedPrice / 0.6);

  let statusText = 'No competitor matches';
  let statusClass = 'status-warning';
  
  if (prices.length > 0) {
    if (suggestedPrice < minPrice) {
      statusText = 'Highly Competitive (Lower than all matches)';
      statusClass = 'status-success';
    } else if (suggestedPrice <= avgPrice) {
      statusText = 'Competitive (Around market average)';
      statusClass = 'status-info';
    } else {
      statusText = 'High Pricing (Above competitor average)';
      statusClass = 'status-danger';
    }
  }

  function handleSave() {
    onApply(suggestedPrice, suggestedOldPrice);
    onClose();
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container price-optimizer-modal">
        <div className="modal-header">
          <div>
            <span className="eyebrow flex-row"><Sparkles size={13} /> Pricing Intelligence</span>
            <h2>Competitor Price Optimizer</h2>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-content-grid">
          {/* Left panel: Search results */}
          <div className="competitors-section">
            <div className="section-header-compact">
              <h3>Competitor Search Matches</h3>
              <p className="query-pill">Search: <em>"{productTitle}"</em></p>
            </div>

            {loading && (
              <div className="modal-state-container">
                <Loader2 className="spinner" size={28} />
                <p>Scanning Pakistani e-commerce platforms...</p>
              </div>
            )}

            {error && (
              <div className="error-alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && results.length === 0 && (
              <div className="empty-state-card">
                <AlertCircle size={24} />
                <p>No matching listings found on competitor stores.</p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="competitor-list">
                {results.map((item, idx) => (
                  <div key={idx} className="competitor-item">
                    <div className="competitor-info">
                      <span className={`source-tag tag-${item.source.toLowerCase()}`}>
                        {item.source}
                      </span>
                      <p className="item-title" title={item.title}>{item.title}</p>
                    </div>
                    <div className="competitor-pricing">
                      <strong>PKR {item.price.toLocaleString('en-PK')}</strong>
                      <a href={item.url} target="_blank" rel="noreferrer" className="external-link" title="Open listing">
                        <ExternalLink size={14} />
                      </a>
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
            <h3>Profit & Margin Builder</h3>
            
            <div className="calculator-inputs">
              <label>
                Product Supplier Cost (PKR)
                <input 
                  type="number"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                />
              </label>

              <div className="margin-selector-row">
                <span>Margin Metric</span>
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
                {marginType === 'flat' ? 'Target Profit (PKR)' : 'Markup Margin (%)'}
                <input 
                  type="number" 
                  min="0"
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(Number(e.target.value))}
                />
              </label>
            </div>

            {/* Calculations review */}
            <div className="calculations-summary">
              <div className="calc-row">
                <span>Total Cost:</span>
                <span>PKR {cost.toLocaleString()}</span>
              </div>
              <div className="calc-row">
                <span>Markup Added:</span>
                <span>{marginType === 'flat' ? `PKR ${profitMargin.toLocaleString()}` : `${profitMargin}%`}</span>
              </div>
              <div className="divider"></div>
              
              <div className="calc-row highlight">
                <span>Recommended Retail:</span>
                <strong>PKR {suggestedPrice.toLocaleString()}</strong>
              </div>

              <div className="calc-row subtext">
                <span>Old Price (40% discount):</span>
                <span className="strike">PKR {suggestedOldPrice.toLocaleString()}</span>
              </div>
            </div>

            {/* Status notification */}
            {prices.length > 0 && (
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
