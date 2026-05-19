import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ImageField } from '../components/ImageField';
import { importImageUrlToCloudinary, uploadToCloudinary } from '../services/cloudinaryService';
import { deleteProduct, listCategories, listProducts, saveProduct } from '../services/firestoreService';
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

  useEffect(() => {
    setPage(1);
  }, [query, status]);

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
            <p>{filteredProducts.length} results</p>
          </div>
          <div className="toolbar-controls">
            <input placeholder="Search products, brands, categories" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All products</option>
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
              <option value="low-stock">Low stock</option>
            </select>
            <button className="ghost" onClick={products.refresh}>Refresh</button>
          </div>
        </div>

        {products.loading && <p>Loading products...</p>}
        {products.error && <p className="error">{products.error}</p>}

        <div className="data-list">
          {pagedProducts.map((product) => (
            <article className="data-card product-card-admin" key={product.id}>
              {product.image ? <img src={product.image} alt="" /> : <div className="empty-thumb">P</div>}
              <div className="data-main">
                <strong>{product.name}</strong>
                <span>{product.brand || 'Glowza'} - {categoryById.get(product.categoryId) || 'No category'}</span>
                <div className="mini-pills">
                  <span>{money(product.price)}</span>
                  <span>Stock {product.stock}</span>
                  <span>{product.isActive ? 'Active' : 'Hidden'}</span>
                </div>
              </div>
              <div className="row-actions">
                <button onClick={() => onEdit(product.id)}>Edit</button>
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
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
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
        stock: Number(scraped.stock || current.stock || 10),
        isActive: scraped.isActive ?? current.isActive,
        brand: scraped.brand || current.brand || 'Markaz',
      }));
    } catch (error) {
      setScrapeError(error instanceof Error ? error.message : 'Scrape failed');
    } finally {
      setScraping(false);
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
          </div>
          {scrapeError && <p className="error">{scrapeError}</p>}
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
        </section>

        <section className="editor-section">
          <div className="section-title">
            <span>5</span>
            <div>
              <h3>Content and Visibility</h3>
              <p>Useful detail improves conversion in the mobile app.</p>
            </div>
          </div>
          <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
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
          <div className="preview-image">{form.image ? <img src={form.image} alt="" /> : <span>No image</span>}</div>
          <h3>{form.name || 'Product name'}</h3>
          <p>{form.brand || 'Brand'} - {form.skinType || 'All skin types'}</p>
          <strong>{money(form.price)}</strong>
          {calculatedDiscount > 0 && <span className="pill">{calculatedDiscount}% off</span>}
          <div className="mini-pills">
            <span>{form.isActive ? 'Active' : 'Hidden'}</span>
            <span>Stock {form.stock || 0}</span>
            <span>{form.images?.length || 0} images</span>
          </div>
        </div>
      </aside>
    </section>
  );
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
