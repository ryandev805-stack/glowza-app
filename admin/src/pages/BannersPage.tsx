import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { ImageField } from '../components/ImageField';
import { deleteBanner, listBanners, saveBanner } from '../services/firestoreService';
import type { Banner } from '../types';
import { useCollection } from '../hooks/useCollection';

const emptyBanner: Omit<Banner, 'id'> = {
  title: '',
  image: '',
  link: '',
  isActive: true,
  sortOrder: 0,
};

export function BannersPage() {
  const loader = useCallback(() => listBanners(), []);
  const { items, loading, error, refresh } = useCollection<Banner>(loader);
  const [form, setForm] = useState<Omit<Banner, 'id'> & { id?: string }>(emptyBanner);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveBanner(form);
      setForm(emptyBanner);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="split-page">
      <form className="panel form" onSubmit={submit}>
        <div className="panel-head">
          <div>
            <span className="eyebrow">Marketing</span>
            <h2>{form.id ? 'Edit Banner' : 'Add Banner'}</h2>
            <p>Use Cloudinary upload or paste a Cloudinary URL.</p>
          </div>
          <button disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
        <label>Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <ImageField label="Banner Image" value={form.image} onChange={(image) => setForm({ ...form, image })} />
        <label>Link<input placeholder="/product/productId or /products?category=Fashion" value={form.link} onChange={(event) => setForm({ ...form, link: event.target.value })} /></label>
        <label>Sort Order<input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></label>
        <label className="check"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
        {form.id && <button type="button" className="ghost" onClick={() => setForm(emptyBanner)}>Cancel Edit</button>}
      </form>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Banners</h2>
            <p>{items.length} slides</p>
          </div>
          <button onClick={refresh}>Refresh</button>
        </div>
        {loading && <p>Loading...</p>}
        {error && <p className="error">{error}</p>}
        <div className="category-grid">
          {items.map((item) => (
            <article key={item.id} className="category-card">
              {item.image ? <img src={item.image} alt="" /> : <div className="empty-thumb">B</div>}
              <div>
                <strong>{item.title}</strong>
                <span>{item.isActive ? 'Active' : 'Hidden'} • {item.link || 'No link'}</span>
              </div>
              <div className="row-actions">
                <button onClick={() => setForm(item)}>Edit</button>
                <button className="danger" onClick={() => void deleteBanner(item.id).then(refresh)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
