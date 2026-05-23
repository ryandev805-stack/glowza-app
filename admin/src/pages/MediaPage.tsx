import { useCallback, useMemo, useState } from 'react';
import { DatabaseZap, Image, RefreshCcw, Trash2, Video } from 'lucide-react';
import { deleteCloudinaryAssets, listCloudinaryAssets, type CloudinaryAsset } from '../services/cloudinaryService';
import { cleanMissingMediaReferences, listBanners, listCategories, listProducts } from '../services/firestoreService';
import type { Banner, Category, Product } from '../types';
import { useCollection } from '../hooks/useCollection';

type MediaRef = {
  owner: string;
  field: string;
  url: string;
  publicId: string;
};

function bytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function cloudinaryPublicId(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('res.cloudinary.com')) return '';
    const afterUpload = parsed.pathname.split('/upload/')[1];
    if (!afterUpload) return '';
    const parts = afterUpload.split('/').filter(Boolean);
    const glowzaIndex = parts.findIndex((part) => part === 'glowza');
    const publicParts = parts.slice(glowzaIndex >= 0 ? glowzaIndex : parts[0]?.startsWith('v') ? 1 : 0);
    return decodeURIComponent(publicParts.join('/').replace(/\.[a-z0-9]+$/i, ''));
  } catch {
    return '';
  }
}

function collectRefs(products: Product[], categories: Category[], banners: Banner[]) {
  const refs: MediaRef[] = [];

  products.forEach((product) => {
    const media = [
      { field: 'image', url: product.image },
      ...(product.images || []).map((url, index) => ({ field: `images[${index}]`, url })),
      ...(product.videos || []).map((url, index) => ({ field: `videos[${index}]`, url })),
    ];
    media.forEach((item) => {
      const publicId = cloudinaryPublicId(item.url || '');
      if (publicId) refs.push({ owner: `Product: ${product.name}`, field: item.field, url: item.url, publicId });
    });
  });

  categories.forEach((category) => {
    const publicId = cloudinaryPublicId(category.image || '');
    if (publicId) refs.push({ owner: `Category: ${category.name}`, field: 'image', url: category.image, publicId });
  });

  banners.forEach((banner) => {
    const publicId = cloudinaryPublicId(banner.image || '');
    if (publicId) refs.push({ owner: `Banner: ${banner.title}`, field: 'image', url: banner.image, publicId });
  });

  return refs;
}

export function MediaPage() {
  const products = useCollection<Product>(useCallback(() => listProducts(), []));
  const categories = useCollection<Category>(useCallback(() => listCategories(), []));
  const banners = useCollection<Banner>(useCallback(() => listBanners(), []));
  const [assets, setAssets] = useState<CloudinaryAsset[]>([]);
  const [resourceType, setResourceType] = useState<'image' | 'video'>('image');
  const [nextCursor, setNextCursor] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refs = useMemo(
    () => collectRefs(products.items, categories.items, banners.items),
    [products.items, categories.items, banners.items],
  );
  const usedPublicIds = useMemo(() => new Set(refs.map((ref) => ref.publicId)), [refs]);
  const assetPublicIds = useMemo(() => new Set(assets.map((asset) => asset.publicId)), [assets]);
  const unusedAssets = assets.filter((asset) => !usedPublicIds.has(asset.publicId));
  const missingRefs: MediaRef[] = [];
  const selectedAssets = assets.filter((asset) => selectedIds.has(asset.publicId));
  const totalBytes = assets.reduce((total, asset) => total + Number(asset.bytes || 0), 0);
  const unusedBytes = unusedAssets.reduce((total, asset) => total + Number(asset.bytes || 0), 0);

  async function refreshAssets(type = resourceType) {
    setLoadingAssets(true);
    setError('');
    try {
      const page = await listCloudinaryAssets(type);
      setAssets(page.assets);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setSelectedIds(new Set());
      setMessage(`Loaded ${page.assets.length} ${type} asset${page.assets.length === 1 ? '' : 's'}.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load Cloudinary assets.');
    } finally {
      setLoadingAssets(false);
    }
  }

  async function loadMoreAssets() {
    if (!hasMore || !nextCursor) return;
    setLoadingAssets(true);
    setError('');
    try {
      const page = await listCloudinaryAssets(resourceType, nextCursor);
      setAssets((current) => {
        const byId = new Map(current.map((asset) => [asset.publicId, asset]));
        page.assets.forEach((asset) => byId.set(asset.publicId, asset));
        return [...byId.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      });
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setMessage(`Loaded ${page.assets.length} more ${resourceType} asset${page.assets.length === 1 ? '' : 's'}.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load more Cloudinary assets.');
    } finally {
      setLoadingAssets(false);
    }
  }

  async function switchResourceType(type: 'image' | 'video') {
    setResourceType(type);
    await refreshAssets(type);
  }

  async function deleteAssets(targets: CloudinaryAsset[]) {
    if (targets.length === 0) return;
    const confirmed = confirm(`Delete ${targets.length} unused Cloudinary asset${targets.length === 1 ? '' : 's'} permanently?`);
    if (!confirmed) return;

    setBusy(true);
    setError('');
    try {
      await deleteCloudinaryAssets(targets.map((asset) => ({ publicId: asset.publicId, resourceType: asset.resourceType })));
      setSelectedIds(new Set());
      setMessage(`Deleted ${targets.length} Cloudinary asset${targets.length === 1 ? '' : 's'} in batches of 100 or fewer.`);
      await refreshAssets();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete Cloudinary assets.');
    } finally {
      setBusy(false);
    }
  }

  async function cleanDatabase() {
    if (missingRefs.length === 0) return;
    const confirmed = confirm(`Remove ${missingRefs.length} missing Cloudinary reference${missingRefs.length === 1 ? '' : 's'} from Firestore products, categories, and banners?`);
    if (!confirmed) return;

    setBusy(true);
    setError('');
    try {
      const result = await cleanMissingMediaReferences(assetPublicIds);
      await Promise.all([products.refresh(), categories.refresh(), banners.refresh()]);
      setMessage(`Database cleaned: ${result.removedRefs} media reference${result.removedRefs === 1 ? '' : 's'} removed.`);
    } catch (cleanError) {
      setError(cleanError instanceof Error ? cleanError.message : 'Could not clean database media references.');
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(publicId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  }

  return (
    <section className="media-page">
      <div className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Storage</span>
          <h1>Media Manager</h1>
          <p>Compare Cloudinary assets with Firestore product, category, and banner media references.</p>
        </div>
        <button disabled={loadingAssets} onClick={() => void refreshAssets()}>
          <RefreshCcw size={17} /> {loadingAssets ? 'Loading...' : 'Load Cloudinary'}
        </button>
      </div>

      <div className="metric-grid">
        <Metric title="Cloudinary Assets" value={assets.length} detail={`${bytes(totalBytes)} stored`} />
        <Metric title="Used References" value={usedPublicIds.size} detail={`${refs.length} database references`} />
        <Metric title="Unused Assets" value={unusedAssets.length} detail={`${bytes(unusedBytes)} can be removed`} />
        <Metric title="Missing DB Refs" value="Paused" detail="disabled with paged scans" />
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Cleanup Actions</h2>
            <p>Cloudinary is loaded with cursor pagination. Delete requests are automatically split into batches of 100 assets or fewer. Database reference cleanup is paused for paged scans.</p>
          </div>
          <div className="actions">
            <button className="ghost" disabled={busy || selectedAssets.length === 0} onClick={() => void deleteAssets(selectedAssets)}>
              <Trash2 size={17} /> Delete Selected ({selectedAssets.length})
            </button>
            <button className="danger" disabled={busy || unusedAssets.length === 0} onClick={() => void deleteAssets(unusedAssets)}>
              <Trash2 size={17} /> Delete All Unused
            </button>
            <button className="ghost" disabled>
              <DatabaseZap size={17} /> Clean Database
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Cloudinary Assets</h2>
            <p>{unusedAssets.length} loaded {resourceType} file{unusedAssets.length === 1 ? '' : 's'} are not used by products, categories, or banners.</p>
          </div>
          <div className="actions">
            <div className="segmented-tabs">
              <button className={resourceType === 'image' ? 'active' : ''} disabled={loadingAssets} onClick={() => void switchResourceType('image')}>Images</button>
              <button className={resourceType === 'video' ? 'active' : ''} disabled={loadingAssets} onClick={() => void switchResourceType('video')}>Videos</button>
            </div>
            <button
              className="ghost"
              disabled={unusedAssets.length === 0}
              onClick={() => setSelectedIds(new Set(unusedAssets.map((asset) => asset.publicId)))}
            >
              Select Loaded Unused
            </button>
          </div>
        </div>
        <div className="media-grid">
          {unusedAssets.map((asset) => (
            <article className={`media-asset-card ${selectedIds.has(asset.publicId) ? 'selected' : ''}`} key={asset.publicId}>
              <label className="select-box">
                <input type="checkbox" checked={selectedIds.has(asset.publicId)} onChange={() => toggleSelected(asset.publicId)} />
              </label>
              <div className="media-preview">
                {asset.resourceType === 'video' ? (
                  <video src={asset.secureUrl} muted playsInline preload="metadata" />
                ) : (
                  <img src={asset.secureUrl} alt="" />
                )}
                <span>{asset.resourceType === 'video' ? <Video size={14} /> : <Image size={14} />}</span>
              </div>
              <strong>{asset.publicId}</strong>
              <p>{asset.format || asset.resourceType} · {bytes(asset.bytes)}</p>
            </article>
          ))}
          {!loadingAssets && unusedAssets.length === 0 && <p className="empty-state">No unused loaded {resourceType} assets found.</p>}
        </div>
        {hasMore && (
          <div className="load-more-row">
            <button className="ghost" disabled={loadingAssets} onClick={() => void loadMoreAssets()}>
              <RefreshCcw size={17} /> {loadingAssets ? 'Loading...' : `Load More ${resourceType === 'image' ? 'Images' : 'Videos'}`}
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Missing Database References</h2>
            <p>Paused while Cloudinary uses cursor pagination, because only part of the asset library is loaded at one time.</p>
          </div>
        </div>
        <div className="data-list compact-list">
          {missingRefs.slice(0, 80).map((ref) => (
            <article className="simple-row" key={`${ref.owner}-${ref.field}-${ref.publicId}`}>
              <div>
                <strong>{ref.owner}</strong>
                <span>{ref.field} · {ref.publicId}</span>
              </div>
            </article>
          ))}
          {missingRefs.length === 0 && <p className="empty-state">No missing Cloudinary references found.</p>}
        </div>
      </section>
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
