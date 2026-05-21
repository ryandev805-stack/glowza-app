import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, PlayCircle, RefreshCcw, Search, Sparkles, UploadCloud } from 'lucide-react';
import { importImageUrlToCloudinary, importMediaUrlToCloudinary } from '../services/cloudinaryService';
import { listCategories, listProducts, saveProduct } from '../services/firestoreService';
import { scanWinningProducts } from '../services/winningProductService';
import type { Category, Product, WinningProductCandidate } from '../types';
import { useCollection } from '../hooks/useCollection';

const defaultUrl = 'https://www.markaz.app/shop/home-page/Cosmetics/Skin%20Care';

function money(value: number | undefined) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
}

export function WinningProductsPage({ onEdit }: { onEdit: (id: string) => void }) {
  const categories = useCollection<Category>(useCallback(() => listCategories(), []));
  const products = useCollection<Product>(useCallback(() => listProducts(), []));
  const [categoryUrl, setCategoryUrl] = useState(defaultUrl);
  const [categoryId, setCategoryId] = useState('');
  const [maxProducts, setMaxProducts] = useState(12);
  const [minPrice, setMinPrice] = useState(200);
  const [maxPrice, setMaxPrice] = useState(5000);
  const [candidates, setCandidates] = useState<WinningProductCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const existingSources = useMemo(
    () => new Set(products.items.map((product) => product.sourceUrl).filter(Boolean)),
    [products.items],
  );
  const selected = candidates.filter((candidate) => selectedIds.has(candidate.id));

  async function scan() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await scanWinningProducts({
        categoryUrl,
        maxProducts,
        minPrice,
        maxPrice,
      });
      const withDuplicates = result.map((candidate) => ({
        ...candidate,
        duplicate: existingSources.has(candidate.sourceUrl),
      }));
      setCandidates(withDuplicates);
      setSelectedIds(new Set(withDuplicates.filter((item) => !item.duplicate && item.winningScore >= 55).map((item) => item.id)));
      setMessage(`Found ${withDuplicates.length} candidate product${withDuplicates.length === 1 ? '' : 's'}.`);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Could not scan Markaz category.');
    } finally {
      setLoading(false);
    }
  }

  function toggle(candidate: WinningProductCandidate) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(candidate.id)) {
        next.delete(candidate.id);
      } else {
        next.add(candidate.id);
      }
      return next;
    });
  }

  async function importSelected() {
    if (!categoryId) {
      setError('Select a Glowza category before importing.');
      return;
    }
    if (selected.length === 0) {
      setError('Select at least one product to import.');
      return;
    }
    setImporting(true);
    setError('');
    setMessage('');
    try {
      let imported = 0;
      let lastId = '';
      for (const candidate of selected) {
        if (candidate.duplicate) continue;
        const images = await Promise.all(
          candidate.images.slice(0, 6).map((image) => importImageUrlToCloudinary(image)),
        );
        const videos = await Promise.all(
          (candidate.videos || []).slice(0, 4).map((video) => importMediaUrlToCloudinary(video)),
        );
        lastId = await saveProduct({
          name: candidate.name,
          description: candidate.description || `Imported from Markaz for admin review. Source: ${candidate.sourceUrl}`,
          price: candidate.price,
          oldPrice: candidate.oldPrice,
          discount: candidate.discount,
          categoryId,
          image: images[0] || '',
          images,
          videos,
          stock: candidate.stock || 10,
          isActive: false,
          brand: candidate.brand || 'Markaz',
          productType: '',
          skinType: 'All',
          rating: 0,
          reviewCount: 0,
          ingredients: '',
          howToUse: '',
          isNew: false,
          isBestSeller: false,
          isFlashSale: false,
          reviews: [],
          source: 'markaz',
          sourceUrl: candidate.sourceUrl,
          markazPrice: candidate.markazPrice,
          markazStatus: candidate.markazStatus || '',
          markazVariationId: candidate.markazVariationId || '',
          markazVariationName: candidate.markazVariationName || '',
          markupPercent: 0,
          cutPriceMarkupPercent: 40,
          winningScore: candidate.winningScore,
          importStatus: 'draft',
          needsReview: true,
        });
        imported += 1;
      }
      await products.refresh();
      setMessage(`Imported ${imported} inactive draft product${imported === 1 ? '' : 's'}.`);
      setSelectedIds(new Set());
      if (imported === 1 && lastId) {
        onEdit(lastId);
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="winning-page">
      <div className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Automation</span>
          <h1>Winning Products</h1>
          <p>Scan Markaz category pages, score skincare opportunities, and import selected products as inactive drafts for review.</p>
        </div>
        <button disabled={loading} onClick={() => void scan()}><Search size={17} /> {loading ? 'Scanning...' : 'Find Winning Products'}</button>
      </div>

      <section className="panel product-editor-pro">
        <div className="panel-head">
          <div>
            <h2>Scanner Settings</h2>
            <p>Pricing rule: margin is applied by Markaz price range, then cut price is calculated for a 40% display discount.</p>
          </div>
          <button className="ghost" onClick={() => void products.refresh()}><RefreshCcw size={17} /> Refresh Products</button>
        </div>
        <div className="form-grid">
          <label>Markaz Category URL<input value={categoryUrl} onChange={(event) => setCategoryUrl(event.target.value)} /></label>
          <label>
            Glowza Category
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Select import category</option>
              {categories.items.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>Max Products<input type="number" min="1" max="30" value={maxProducts} onChange={(event) => setMaxProducts(Number(event.target.value))} /></label>
          <label>Min Markaz Price<input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(Number(event.target.value))} /></label>
          <label>Max Markaz Price<input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} /></label>
        </div>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Candidate Products</h2>
            <p>{selected.length} selected from {candidates.length} scanned products</p>
          </div>
          <div className="toolbar-controls">
            <button className="ghost" disabled={candidates.length === 0} onClick={() => setSelectedIds(new Set(candidates.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.id)))}>
              Select All
            </button>
            <button disabled={importing || selected.length === 0} onClick={() => void importSelected()}>
              <UploadCloud size={17} /> {importing ? 'Importing...' : 'Import Selected Inactive'}
            </button>
          </div>
        </div>

        <div className="data-list">
          {candidates.map((candidate) => (
            <article key={candidate.id} className={`data-card product-card-admin ${selectedIds.has(candidate.id) ? 'selected' : ''}`}>
              {candidate.image ? (
                <div className="admin-media-thumb">
                  <img src={candidate.image} alt="" />
                  {candidate.videos.length > 0 && <span><PlayCircle size={14} /></span>}
                </div>
              ) : candidate.videos[0] ? (
                <div className="admin-media-thumb">
                  <video src={candidate.videos[0]} muted playsInline preload="metadata" />
                  <span><PlayCircle size={14} /></span>
                </div>
              ) : (
                <div className="empty-thumb"><Sparkles size={20} /></div>
              )}
              <div className="data-main">
                <strong>{candidate.name}</strong>
                <span>{candidate.brand} - score {candidate.winningScore}/100</span>
                <div className="mini-pills">
                  <span>Markaz {money(candidate.markazPrice)}</span>
                  <span>Sale {money(candidate.price)}</span>
                  <span>Cut {money(candidate.oldPrice)}</span>
                  <span>{candidate.discount}% off</span>
                  <span>{candidate.images.length} images</span>
                  {candidate.videos.length > 0 && <span>{candidate.videos.length} videos</span>}
                  {candidate.markazVariationName && <span>{candidate.markazVariationName}</span>}
                  {candidate.markazStatus && <span>{candidate.markazStatus}</span>}
                  {candidate.duplicate && <span>Duplicate</span>}
                </div>
                <small>{candidate.reasons.join(' | ') || 'Needs manual review'}</small>
              </div>
              <div className="row-actions">
                <a className="ghost-link" href={candidate.sourceUrl} target="_blank" rel="noreferrer">Open</a>
                <button className="ghost" disabled={candidate.duplicate} onClick={() => toggle(candidate)}>
                  <CheckCircle2 size={17} />
                  {selectedIds.has(candidate.id) ? 'Selected' : 'Select'}
                </button>
              </div>
            </article>
          ))}
          {candidates.length === 0 && <p className="muted">Paste the Markaz Skin Care category URL and scan to find products.</p>}
        </div>
      </section>
    </section>
  );
}
