import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { ImageField } from '../components/ImageField';
import { deleteCategory, listCategories, saveCategory } from '../services/firestoreService';
import type { Category } from '../types';
import { useCollection } from '../hooks/useCollection';

const emptyCategory: Omit<Category, 'id'> = {
  name: '',
  image: '',
  isActive: true,
};

export function CategoriesPage() {
  const loader = useCallback(() => listCategories(), []);
  const { items, loading, error, refresh } = useCollection<Category>(loader);
  const [form, setForm] = useState<Omit<Category, 'id'> & { id?: string }>(emptyCategory);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveCategory(form);
      setForm(emptyCategory);
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
            <span className="eyebrow">Catalogue</span>
            <h2>{form.id ? 'Edit Category' : 'Add Category'}</h2>
          </div>
          <button disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
        <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <ImageField label="Category Image" value={form.image} onChange={(image) => setForm({ ...form, image })} />
        <label className="check"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
        {form.id && <button type="button" className="ghost" onClick={() => setForm(emptyCategory)}>Cancel Edit</button>}
      </form>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Categories</h2>
            <p>{items.length} total</p>
          </div>
          <button onClick={refresh}>Refresh</button>
        </div>
        {loading && <p>Loading...</p>}
        {error && <p className="error">{error}</p>}
        <div className="category-grid">
          {items.map((item) => (
            <article key={item.id} className="category-card">
              {item.image ? <img src={item.image} alt="" /> : <div className="empty-thumb">{item.name.slice(0, 1)}</div>}
              <div>
                <strong>{item.name}</strong>
                <span>{item.isActive ? 'Active' : 'Hidden'}</span>
              </div>
              <div className="row-actions">
                <button onClick={() => setForm(item)}>Edit</button>
                <button className="danger" onClick={() => void deleteCategory(item.id).then(refresh)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
