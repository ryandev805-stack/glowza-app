import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, EyeOff, Flame, PlayCircle, RefreshCcw, ShieldCheck, Trash2, X } from 'lucide-react';
import { ImageField } from '../components/ImageField';
import { RichTextEditor } from '../components/RichTextEditor';
import { importImageUrlToCloudinary, importMediaUrlToCloudinary, uploadToCloudinary } from '../services/cloudinaryService';
import { bulkDeleteProducts, bulkUpdateProducts, deleteProduct, listCategories, listProducts, saveProduct } from '../services/firestoreService';
import { syncMarkazProduct } from '../services/markazSyncService';
import { scrapeProduct } from '../services/scraperService';
import type { Category, Product } from '../types';
import { useCollection } from '../hooks/useCollection';

const emptyProduct: Omit<Product, 'id'> = {
  name: '',
  description: '',
  price: 0,
  categoryId: '',
  image: '',
  images: [],
  videos: [],
  stock: 10,
  isActive: true,
  brand: '',
  productType: '',
  skinType: 'All',
  oldPrice: 0,
  discount: 0,
  rating: 0,
  reviewCount: 0,
  ingredients: '',
  howToUse: '',
  isNew: false,
  isBestSeller: false,
  isFlashSale: false,
  source: '',
  sourceUrl: '',
  markazPrice: 0,
  markupPercent: 70,
  cutPriceMarkupPercent: 40,
  needsReview: false,
  reviews: [],
};

function calcDiscount(price: number, oldPrice?: number) {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

function money(value: number | undefined) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
}

export function ProductsPage({
  onCreate,
  onEdit,
}: {
  onCreate: () => void;
  onEdit: (id: string) => void;
}) {
  const products = useCollection<Product>(useCallback(() => listProducts(), []));
  const categories = useCollection<Category>(useCallback(() => listCategories(), []));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [syncingId, setSyncingId] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const pageSize = 10;

  const categoryById = useMemo(
    () => new Map(categories.items.map((category) => [category.id, category.name])),
    [categories.items],
  );
  const filteredProducts = products.items.filter((product) => {
    const text = `${product.name} ${product.brand || ''} ${categoryById.get(product.categoryId) || ''}`.toLowerCase();
    const statusMatches =
      status === 'all' ||
      (status === 'active' && product.isActive) ||
      (status === 'hidden' && !product.isActive) ||
      (status === 'low-stock' && Number(product.stock || 0) <= 5);
    return text.includes(query.toLowerCase()) && statusMatches;
  });
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const pagedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);
  const lowStock = products.items.filter((product) => Number(product.stock || 0) <= 5).length;
  const active = products.items.filter((product) => product.isActive).length;
  const markazProducts = products.items.filter((product) => Boolean(product.sourceUrl));
  const selectedProducts = products.items.filter((product) => selectedIds.has(product.id));
  const selectedActive = selectedProducts.filter((product) => product.isActive).length;
  const selectedReview = selectedProducts.filter((product) => product.needsReview).length;

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => products.items.some((product) => product.id === id))));
  }, [products.items]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function togglePageSelected() {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = pagedProducts.every((product) => next.has(product.id));
      pagedProducts.forEach((product) => {
        if (allSelected) {
          next.delete(product.id);
        } else {
          next.add(product.id);
        }
      });
      return next;
    });
  }

  async function runBulk(action: string) {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = [...selectedIds];
      if (action === 'active') await bulkUpdateProducts(ids, { isActive: true, needsReview: false });
      if (action === 'hidden') await bulkUpdateProducts(ids, { isActive: false });
      if (action === 'review') await bulkUpdateProducts(ids, { isActive: false, needsReview: true });
      if (action === 'clear-review') await bulkUpdateProducts(ids, { needsReview: false });
      if (action === 'flash') await bulkUpdateProducts(ids, { isFlashSale: true });
      if (action === 'delete') {
        if (!confirm(`Delete ${ids.length} selected product${ids.length === 1 ? '' : 's'}?`)) return;
        await bulkDeleteProducts(ids);
      }
      setSelectedIds(new Set());
      await products.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  async function syncProduct(product: Product) {
    setSyncingId(product.id);
    try {
      const result = await syncMarkazProduct(product.id);
      await products.refresh();
      if (result.changed) {
        alert(`${product.name} was changed on Markaz and is now inactive for review:\n\n${(result.changeSummary || []).join('\n')}`);
      } else {
        alert(`${product.name} is already up to date.`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not sync product');
    } finally {
      setSyncingId('');
    }
  }

  async function syncAllProducts() {
    const linkedProducts = products.items.filter((product) => Boolean(product.sourceUrl));
    if (linkedProducts.length === 0) {
      alert('No products have Markaz source links saved.');
      return;
    }
    const confirmed = confirm(`Sync ${linkedProducts.length} Markaz-linked product${linkedProducts.length === 1 ? '' : 's'} now?`);
    if (!confirmed) return;

    setSyncingAll(true);
    setSyncProgress(`0/${linkedProducts.length} synced`);
    let completed = 0;
    let failed = 0;
    let changedCount = 0;
    let index = 0;

    async function worker() {
      while (index < linkedProducts.length) {
        const product = linkedProducts[index];
        index += 1;
        setSyncingId(product.id);
        try {
          const result = await syncMarkazProduct(product.id);
          if (result.changed) changedCount += 1;
        } catch {
          failed += 1;
        } finally {
          completed += 1;
          setSyncProgress(`${completed}/${linkedProducts.length} synced, ${changedCount} changed${failed ? `, ${failed} failed` : ''}`);
        }
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(3, linkedProducts.length) }, worker));
      await products.refresh();
      alert(`Sync complete. ${changedCount} product${changedCount === 1 ? '' : 's'} changed and were marked inactive for review.${failed ? ` ${failed} failed.` : ''}`);
    } finally {
      setSyncingId('');
      setSyncingAll(false);
    }
  }

  return (
    <section className="catalogue-page">
      <div className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Catalogue</span>
          <h1>Products</h1>
          <p>Manage Glowza inventory, pricing, product media, and storefront visibility.</p>
        </div>
        <button onClick={onCreate}>Add Product</button>
      </div>

      <div className="metric-grid">
        <Metric title="Total Products" value={products.items.length} detail={`${active} active`} />
        <Metric title="Low Stock" value={lowStock} detail="5 or fewer units" />
        <Metric title="Categories" value={categories.items.length} detail="available groups" />
        <Metric title="Visible" value={active} detail={`${products.items.length - active} hidden`} />
      </div>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Product Catalogue</h2>
            <p>{filteredProducts.length} results · {selectedIds.size} selected</p>
          </div>
          <div className="toolbar-controls">
            <input placeholder="Search products, brands, categories" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All products</option>
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
              <option value="low-stock">Low stock</option>
            </select>
            <button className="ghost" disabled={syncingAll || markazProducts.length === 0} onClick={() => void syncAllProducts()}>
              <RefreshCcw size={17} />
              {syncingAll ? syncProgress || 'Syncing...' : `Sync All (${markazProducts.length})`}
            </button>
            <button className="ghost" onClick={products.refresh}>Refresh</button>
          </div>
        </div>

        {products.loading && <p>Loading products...</p>}
        {products.error && <p className="error">{products.error}</p>}
        <div className={`bulk-bar pro-bulk-bar ${selectedIds.size ? 'has-selection' : ''}`}>
          <div className="bulk-selection">
            <label className="check">
              <input
                type="checkbox"
                checked={pagedProducts.length > 0 && pagedProducts.every((product) => selectedIds.has(product.id))}
                onChange={togglePageSelected}
              />
              Select page
            </label>
            <div>
              <strong>{selectedProducts.length} selected</strong>
              <span>{selectedActive} active · {selectedReview} need review</span>
            </div>
          </div>
          <div className="bulk-action-groups">
            <div className="bulk-group">
              <span>Visibility</span>
              <button className="ghost" disabled={bulkBusy || selectedIds.size === 0} onClick={() => void runBulk('active')}><CheckCircle2 size={15} /> Active</button>
              <button className="ghost" disabled={bulkBusy || selectedIds.size === 0} onClick={() => void runBulk('hidden')}><EyeOff size={15} /> Hide</button>
            </div>
            <div className="bulk-group">
              <span>Review</span>
              <button className="ghost" disabled={bulkBusy || selectedIds.size === 0} onClick={() => void runBulk('review')}><AlertTriangle size={15} /> Needs Review</button>
              <button className="ghost" disabled={bulkBusy || selectedIds.size === 0} onClick={() => void runBulk('clear-review')}><ShieldCheck size={15} /> Clear</button>
            </div>
            <div className="bulk-group">
              <span>Promo</span>
              <button className="ghost" disabled={bulkBusy || selectedIds.size === 0} onClick={() => void runBulk('flash')}><Flame size={15} /> Flash Sale</button>
            </div>
            <div className="bulk-group danger-group">
              <span>Danger</span>
              <button className="ghost" disabled={bulkBusy || selectedIds.size === 0} onClick={() => setSelectedIds(new Set())}><X size={15} /> Clear Selection</button>
              <button className="danger" disabled={bulkBusy || selectedIds.size === 0} onClick={() => void runBulk('delete')}><Trash2 size={15} /> Delete</button>
            </div>
          </div>
        </div>

        <div className="data-list">
          {pagedProducts.map((product) => (
            <article className="data-card product-card-admin" key={product.id}>
              <label className="select-box" aria-label={`Select ${product.name}`}>
                <input type="checkbox" checked={selectedIds.has(product.id)} onChange={() => toggleSelected(product.id)} />
              </label>
              <AdminProductMedia product={product} />
              <div className="data-main">
                <strong>{product.name}</strong>
                <span>{product.brand || 'Glowza'} - {categoryById.get(product.categoryId) || 'No category'}</span>
                <div className="mini-pills">
                  <span>{money(product.price)}</span>
                  {product.markazPrice ? <span>Markaz {money(product.markazPrice)}</span> : null}
                  <span>Stock {product.stock}</span>
                  <span>{product.isActive ? 'Active' : 'Hidden'}</span>
                  {product.sourceUrl ? <span>Markaz Sync</span> : null}
                  {product.needsReview ? <span>Needs review</span> : null}
                </div>
                {product.syncChangeSummary?.length ? <small>Changed: {product.syncChangeSummary.slice(0, 3).join(', ')}</small> : null}
              </div>
              <div className="row-actions">
                <button onClick={() => onEdit(product.id)}>Edit</button>
                {product.sourceUrl && (
                  <>
                    <a className="ghost-link" href={product.sourceUrl} target="_blank" rel="noreferrer">Source</a>
                    <button className="ghost" disabled={syncingAll || syncingId === product.id} onClick={() => void syncProduct(product)}>
                      {syncingId === product.id ? 'Syncing...' : 'Sync'}
                    </button>
                  </>
                )}
                <button
                  className="danger"
                  onClick={() => {
                    if (confirm(`Delete ${product.name}?`)) {
                      void deleteProduct(product.id).then(products.refresh);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="pagination">
          <button className="ghost" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <span>Page {page} of {pageCount}</span>
          <button className="ghost" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button>
        </div>
      </section>
    </section>
  );
}

export function ProductEditorPage({
  productId,
  onDone,
}: {
  productId?: string;
  onDone: () => void;
}) {
  const products = useCollection<Product>(useCallback(() => listProducts(), []));
  const categories = useCollection<Category>(useCallback(() => listCategories(), []));
  const [form, setForm] = useState<Omit<Product, 'id'> & { id?: string }>(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [galleryUrl, setGalleryUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scrapeError, setScrapeError] = useState('');

  const calculatedDiscount = useMemo(
    () => calcDiscount(Number(form.price) || 0, Number(form.oldPrice) || 0),
    [form.price, form.oldPrice],
  );

  useEffect(() => {
    if (!productId || products.loading) return;
    const product = products.items.find((item) => item.id === productId);
    if (product) {
      setForm({
        ...emptyProduct,
        ...product,
        images: product.images?.length ? product.images : product.image ? [product.image] : [],
        videos: product.videos || [],
        reviews: product.reviews || [],
      });
    }
  }, [productId, products.items, products.loading]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveProduct({ ...form, discount: calculatedDiscount });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  async function fillFromUrl() {
    setScraping(true);
    setScrapeError('');
    try {
      const scraped = await scrapeProduct(scrapeUrl);
      const rawImages = scraped.images?.length ? scraped.images : scraped.image ? [scraped.image] : [];
      const cloudinaryImages = rawImages.length
        ? await Promise.all(rawImages.slice(0, 6).map((image) => importImageUrlToCloudinary(image)))
        : [];
      setForm((current) => ({
        ...current,
        name: scraped.name || current.name,
        description: scraped.description || current.description,
        price: Number(scraped.price || current.price || 0),
        oldPrice: Number(scraped.oldPrice || scraped.price || current.oldPrice || 0),
        image: cloudinaryImages[0] || current.image,
        images: cloudinaryImages.length ? cloudinaryImages : current.images,
        videos: scraped.videos?.length ? scraped.videos : current.videos,
        stock: Number(scraped.stock || current.stock || 10),
        isActive: scraped.isActive ?? current.isActive,
        brand: scraped.brand || current.brand || 'Markaz',
        source: 'markaz',
        sourceUrl: scraped.sourceUrl || scrapeUrl,
      }));
    } catch (error) {
      setScrapeError(error instanceof Error ? error.message : 'Scrape failed');
    } finally {
      setScraping(false);
    }
  }

  async function syncCurrentProduct() {
    if (!productId) return;
    setSyncing(true);
    setScrapeError('');
    try {
      const result = await syncMarkazProduct(productId);
      setForm((current) => ({
        ...current,
        ...result.product,
        images: result.product.images?.length
          ? result.product.images
          : result.product.image
            ? [result.product.image]
            : current.images,
      }));
    } catch (error) {
      setScrapeError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function importGalleryUrl() {
    if (!galleryUrl.trim()) return;
    setGalleryBusy(true);
    try {
      const uploaded = await importImageUrlToCloudinary(galleryUrl.trim());
      addGalleryImage(uploaded);
      setGalleryUrl('');
    } finally {
      setGalleryBusy(false);
    }
  }

  async function uploadGalleryFiles(files?: FileList | null) {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;
    setGalleryBusy(true);
    try {
      const uploadedImages = await Promise.all(
        selectedFiles.map((file) => uploadToCloudinary(file)),
      );
      addGalleryImages(uploadedImages);
    } finally {
      setGalleryBusy(false);
    }
  }

  async function importVideoUrl() {
    if (!videoUrl.trim()) return;
    setVideoBusy(true);
    try {
      const uploaded = await importMediaUrlToCloudinary(videoUrl.trim());
      addVideos([uploaded]);
      setVideoUrl('');
    } finally {
      setVideoBusy(false);
    }
  }

  async function uploadVideoFiles(files?: FileList | null) {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;
    setVideoBusy(true);
    try {
      const uploadedVideos = await Promise.all(
        selectedFiles.map((file) => uploadToCloudinary(file)),
      );
      addVideos(uploadedVideos);
    } finally {
      setVideoBusy(false);
    }
  }

  function addGalleryImage(image: string) {
    addGalleryImages([image]);
  }

  function addGalleryImages(nextImages: string[]) {
    setForm((current) => {
      const images = Array.from(
        new Set([...(current.images || []), ...nextImages]),
      );
      return { ...current, images, image: current.image || images[0] || '' };
    });
  }

  function removeImage(index: number) {
    setForm((current) => {
      const removed = current.images?.[index];
      const images = (current.images || []).filter((_, itemIndex) => itemIndex !== index);
      return { ...current, images, image: current.image === removed ? images[0] || '' : current.image };
    });
  }

  function addVideos(nextVideos: string[]) {
    setForm((current) => ({
      ...current,
      videos: Array.from(new Set([...(current.videos || []), ...nextVideos.filter(Boolean)])),
    }));
  }

  function removeVideo(index: number) {
    setForm((current) => ({
      ...current,
      videos: (current.videos || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  return (
    <section className="editor-page">
      <form className="panel product-editor-pro" onSubmit={submit}>
        <div className="panel-head">
          <div>
            <span className="eyebrow">Product Studio</span>
            <h2>{productId ? 'Edit Product' : 'Create Product'}</h2>
            <p>Use structured fields. Media is imported into Cloudinary before saving to Firestore.</p>
          </div>
          <div className="actions">
            <button type="button" className="ghost" onClick={onDone}>Back</button>
            <button disabled={saving || categories.items.length === 0}>{saving ? 'Saving...' : 'Save Product'}</button>
          </div>
        </div>

        <section className="editor-section">
          <div className="section-title">
            <span>1</span>
            <div>
              <h3>Import or Start Manually</h3>
              <p>Scraping prefills the form only. You still review and save manually.</p>
            </div>
          </div>
          <div className="inline-actions">
            <input placeholder="Paste Markaz product URL" value={scrapeUrl} onChange={(event) => setScrapeUrl(event.target.value)} />
            <button type="button" disabled={scraping || !scrapeUrl.trim()} onClick={fillFromUrl}>
              {scraping ? 'Filling...' : 'Fill Form'}
            </button>
            {productId && form.sourceUrl && (
              <button type="button" className="ghost" disabled={syncing} onClick={() => void syncCurrentProduct()}>
                {syncing ? 'Syncing...' : 'Sync Markaz'}
              </button>
            )}
          </div>
          {scrapeError && <p className="error">{scrapeError}</p>}
          <label>
            Saved Markaz Product Link
            <input
              placeholder="https://www.markaz.app/shop/product/..."
              value={form.sourceUrl || ''}
              onChange={(event) => setForm({ ...form, source: event.target.value ? 'markaz' : '', sourceUrl: event.target.value })}
            />
          </label>
        </section>

        <section className="editor-section">
          <div className="section-title">
            <span>2</span>
            <div>
              <h3>Core Details</h3>
              <p>These fields control storefront listing and checkout behavior.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Brand<input value={form.brand || ''} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></label>
            <label>
              Category
              <select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                <option value="">Select category</option>
                {categories.items.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label>Product Type<input value={form.productType || ''} onChange={(event) => setForm({ ...form, productType: event.target.value })} /></label>
            <label>Skin Type<input value={form.skinType || ''} onChange={(event) => setForm({ ...form, skinType: event.target.value })} /></label>
            <label>Stock<input type="number" min="0" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })} /></label>
          </div>
        </section>

        <section className="editor-section">
          <div className="section-title">
            <span>3</span>
            <div>
              <h3>Pricing</h3>
              <p>Discount is calculated automatically from old price and sale price.</p>
            </div>
          </div>
          <div className="form-grid compact">
            <label>Sale Price<input required type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label>
            <label>Old Price<input type="number" min="0" value={form.oldPrice || 0} onChange={(event) => setForm({ ...form, oldPrice: Number(event.target.value) })} /></label>
            <label>Discount<input readOnly value={`${calculatedDiscount}%`} /></label>
          </div>
        </section>

        <section className="editor-section">
          <div className="section-title">
            <span>4</span>
            <div>
              <h3>Media</h3>
              <p>Paste URLs or upload files. Pasted URLs are copied into Cloudinary.</p>
            </div>
          </div>
          <ImageField
            label="Main Image"
            value={form.image}
            onChange={(image) => setForm({ ...form, image, images: form.images?.length ? Array.from(new Set([image, ...form.images])) : image ? [image] : [] })}
          />
          <div className="inline-actions">
            <input placeholder="Paste gallery image URL" value={galleryUrl} onChange={(event) => setGalleryUrl(event.target.value)} />
            <button type="button" disabled={galleryBusy || !galleryUrl.trim()} onClick={importGalleryUrl}>
              {galleryBusy ? 'Importing...' : 'Import URL'}
            </button>
          </div>
          <label>
            Upload Gallery Image
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => void uploadGalleryFiles(event.target.files)}
            />
            {galleryBusy && <small>Uploading gallery images...</small>}
          </label>
          <div className="gallery-grid">
            {(form.images || []).map((image, index) => (
              <article key={`${image}-${index}`} className="gallery-item">
                <img src={image} alt="" />
                <button type="button" className="danger" onClick={() => removeImage(index)}>Remove</button>
              </article>
            ))}
          </div>
          <div className="inline-actions media-actions">
            <input placeholder="Paste product video URL" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} />
            <button type="button" disabled={videoBusy || !videoUrl.trim()} onClick={importVideoUrl}>
              {videoBusy ? 'Importing...' : 'Import Video'}
            </button>
          </div>
          <label>
            Upload Product Videos
            <input
              type="file"
              accept="video/*"
              multiple
              onChange={(event) => void uploadVideoFiles(event.target.files)}
            />
            {videoBusy && <small>Uploading product videos...</small>}
          </label>
          <div className="gallery-grid">
            {(form.videos || []).map((video, index) => (
              <article key={`${video}-${index}`} className="gallery-item video-item">
                <video src={video} muted playsInline controls preload="metadata" />
                <button type="button" className="danger" onClick={() => removeVideo(index)}>Remove</button>
              </article>
            ))}
          </div>
        </section>

        <section className="editor-section">
          <div className="section-title">
            <span>5</span>
            <div>
              <h3>Content and Visibility</h3>
              <p>Useful detail improves conversion in the mobile app.</p>
            </div>
          </div>
          <RichTextEditor
            label="Description"
            value={form.description}
            onChange={(description) => setForm({ ...form, description })}
          />
          <div className="two">
            <label>Ingredients<textarea value={form.ingredients || ''} onChange={(event) => setForm({ ...form, ingredients: event.target.value })} /></label>
            <label>How To Use<textarea value={form.howToUse || ''} onChange={(event) => setForm({ ...form, howToUse: event.target.value })} /></label>
          </div>
          <div className="checks">
            <label><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
            <label><input type="checkbox" checked={Boolean(form.isNew)} onChange={(event) => setForm({ ...form, isNew: event.target.checked })} /> New Arrival</label>
            <label><input type="checkbox" checked={Boolean(form.isBestSeller)} onChange={(event) => setForm({ ...form, isBestSeller: event.target.checked })} /> Best Seller</label>
            <label><input type="checkbox" checked={Boolean(form.isFlashSale)} onChange={(event) => setForm({ ...form, isFlashSale: event.target.checked })} /> Flash Sale</label>
          </div>
        </section>
      </form>

      <aside className="editor-preview">
        <div className="panel preview-panel">
          <span className="eyebrow">Live Preview</span>
          <div className="preview-image">
            {form.image ? <img src={form.image} alt="" /> : form.videos?.[0] ? <video src={form.videos[0]} muted playsInline controls preload="metadata" /> : <span>No media</span>}
          </div>
          <h3>{form.name || 'Product name'}</h3>
          <p>{form.brand || 'Brand'} - {form.skinType || 'All skin types'}</p>
          <strong>{money(form.price)}</strong>
          {calculatedDiscount > 0 && <span className="pill">{calculatedDiscount}% off</span>}
          <div className="mini-pills">
            <span>{form.isActive ? 'Active' : 'Hidden'}</span>
            <span>Stock {form.stock || 0}</span>
            <span>{form.images?.length || 0} images</span>
            <span>{form.videos?.length || 0} videos</span>
            {form.sourceUrl && <span>Markaz linked</span>}
          </div>
          {form.sourceUrl && <a className="ghost-link" href={form.sourceUrl} target="_blank" rel="noreferrer">Open Markaz Source</a>}
        </div>
      </aside>
    </section>
  );
}

function AdminProductMedia({ product }: { product: Product }) {
  const image = product.image || product.images?.[0] || '';
  const video = !image ? product.videos?.[0] : '';
  if (image) {
    return (
      <div className="admin-media-thumb">
        <img src={image} alt="" />
        {product.videos?.length ? <span><PlayCircle size={14} /></span> : null}
      </div>
    );
  }
  if (video) {
    return (
      <div className="admin-media-thumb">
        <video src={video} muted playsInline preload="metadata" />
        <span><PlayCircle size={14} /></span>
      </div>
    );
  }
  return <div className="empty-thumb">P</div>;
}

function Metric({ title, value, detail }: { title: string; value: number | string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
